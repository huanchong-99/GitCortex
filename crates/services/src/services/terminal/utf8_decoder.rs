//! Shared UTF-8 streaming decoder for PTY output pipelines.
//!
//! Goals:
//! - Distinguish incomplete tail bytes vs invalid middle bytes.
//! - Keep incomplete tail for the next chunk (streaming behavior).
//! - Apply lossy decoding for invalid middle bytes to avoid buffer deadlock.
//! - Track dropped invalid byte statistics for observability.

/// Aggregate decoder statistics.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Utf8DecodeStats {
    /// Total invalid bytes dropped (lossy-decoded) across all chunks.
    pub dropped_invalid_bytes: usize,
    /// Number of decode calls that ended with an incomplete UTF-8 tail.
    pub incomplete_tail_events: usize,
    /// Number of non-empty chunks processed.
    pub decoded_chunks: usize,
}

/// Per-chunk decode result.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Utf8DecodeChunk {
    /// Decoded UTF-8 text (may include replacement characters from lossy decode).
    pub text: String,
    /// Invalid bytes dropped in this decode call.
    pub dropped_invalid_bytes: usize,
    /// Whether decode ended with an incomplete UTF-8 tail.
    pub had_incomplete_tail: bool,
    /// Pending tail length kept for next chunk.
    pub pending_tail_len: usize,
}

/// Streaming UTF-8 decoder with pending tail buffer.
#[derive(Debug, Clone, Default)]
pub struct Utf8StreamDecoder {
    pending_tail: Vec<u8>,
    stats: Utf8DecodeStats,
}

impl Utf8StreamDecoder {
    /// Create a new decoder.
    pub fn new() -> Self {
        Self::default()
    }

    /// Decode one chunk of bytes.
    ///
    /// Behavior:
    /// - Valid UTF-8 is appended to output text.
    /// - Invalid middle bytes are lossy-decoded and counted as dropped bytes.
    /// - Incomplete tail bytes are preserved for the next call.
    pub fn decode_chunk(&mut self, chunk: &[u8]) -> Utf8DecodeChunk {
        if chunk.is_empty() {
            return Utf8DecodeChunk {
                text: String::new(),
                dropped_invalid_bytes: 0,
                had_incomplete_tail: false,
                pending_tail_len: self.pending_tail.len(),
            };
        }

        self.stats.decoded_chunks += 1;

        let mut buffer = std::mem::take(&mut self.pending_tail);
        buffer.extend_from_slice(chunk);

        let mut output = String::new();
        let mut cursor = 0usize;
        let mut dropped_invalid_bytes = 0usize;
        let mut had_incomplete_tail = false;

        while cursor < buffer.len() {
            let remaining = &buffer[cursor..];
            match std::str::from_utf8(remaining) {
                Ok(valid_text) => {
                    output.push_str(valid_text);
                    cursor = buffer.len();
                }
                Err(error) => {
                    let valid_prefix_len = error.valid_up_to();
                    if valid_prefix_len > 0 {
                        if let Ok(valid_prefix) = std::str::from_utf8(&remaining[..valid_prefix_len]) {
                            output.push_str(valid_prefix);
                        }
                        cursor += valid_prefix_len;
                    }

                    match error.error_len() {
                        // Invalid bytes in the middle: lossy decode and continue.
                        Some(error_len) => {
                            let remaining_len = buffer.len().saturating_sub(cursor);
                            let invalid_len = error_len.max(1).min(remaining_len);
                            let invalid_slice = &buffer[cursor..cursor + invalid_len];
                            output.push_str(&String::from_utf8_lossy(invalid_slice));
                            dropped_invalid_bytes += invalid_len;
                            cursor += invalid_len;
                        }
                        // Incomplete bytes at tail: keep for next decode call.
                        None => {
                            had_incomplete_tail = true;
                            break;
                        }
                    }
                }
            }
        }

        if had_incomplete_tail {
            self.pending_tail = buffer[cursor..].to_vec();
            self.stats.incomplete_tail_events += 1;
        } else {
            self.pending_tail.clear();
        }

        self.stats.dropped_invalid_bytes += dropped_invalid_bytes;

        Utf8DecodeChunk {
            text: output,
            dropped_invalid_bytes,
            had_incomplete_tail,
            pending_tail_len: self.pending_tail.len(),
        }
    }

    /// Flush pending incomplete tail using lossy strategy.
    ///
    /// Useful when stream ends and caller wants best-effort final text.
    pub fn flush_lossy_tail(&mut self) -> Option<String> {
        if self.pending_tail.is_empty() {
            return None;
        }
        let tail = std::mem::take(&mut self.pending_tail);
        Some(String::from_utf8_lossy(&tail).to_string())
    }

    /// Current pending tail length.
    pub fn pending_tail_len(&self) -> usize {
        self.pending_tail.len()
    }

    /// Snapshot of decoder stats.
    pub fn stats(&self) -> Utf8DecodeStats {
        self.stats
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_complete_utf8_chunk() {
        let mut decoder = Utf8StreamDecoder::new();
        let result = decoder.decode_chunk("Hello, 世界".as_bytes());

        assert_eq!(result.text, "Hello, 世界");
        assert_eq!(result.dropped_invalid_bytes, 0);
        assert!(!result.had_incomplete_tail);
        assert_eq!(result.pending_tail_len, 0);
    }

    #[test]
    fn test_decode_preserves_incomplete_tail_until_next_chunk() {
        let mut decoder = Utf8StreamDecoder::new();

        // "你" + incomplete "好"
        let first = decoder.decode_chunk(&[228, 189, 160, 229, 165]);
        assert_eq!(first.text, "你");
        assert_eq!(first.dropped_invalid_bytes, 0);
        assert!(first.had_incomplete_tail);
        assert_eq!(first.pending_tail_len, 2);

        // Complete the tail for "好"
        let second = decoder.decode_chunk(&[189]);
        assert_eq!(second.text, "好");
        assert_eq!(second.dropped_invalid_bytes, 0);
        assert!(!second.had_incomplete_tail);
        assert_eq!(second.pending_tail_len, 0);
    }

    #[test]
    fn test_decode_lossy_for_invalid_middle_bytes() {
        let mut decoder = Utf8StreamDecoder::new();
        let result = decoder.decode_chunk(&[b'O', b'K', 0xFF, 0xFE, b'!']);

        assert_eq!(result.text, "OK��!");
        assert_eq!(result.dropped_invalid_bytes, 2);
        assert!(!result.had_incomplete_tail);
        assert_eq!(result.pending_tail_len, 0);
    }

    #[test]
    fn test_decode_no_stall_after_incomplete_then_invalid() {
        let mut decoder = Utf8StreamDecoder::new();

        // Incomplete lead bytes kept in tail.
        let first = decoder.decode_chunk(&[0xE4, 0xBD]);
        assert!(first.had_incomplete_tail);
        assert_eq!(first.pending_tail_len, 2);

        // Next chunk makes prior tail invalid; decoder must recover and continue.
        let second = decoder.decode_chunk(b"X");
        assert!(second.text.ends_with('X'));
        assert!(second.dropped_invalid_bytes >= 1);
        assert_eq!(second.pending_tail_len, 0);
    }

    #[test]
    fn test_flush_lossy_tail() {
        let mut decoder = Utf8StreamDecoder::new();
        let _ = decoder.decode_chunk(&[0xE4, 0xBD]); // incomplete UTF-8 tail
        assert_eq!(decoder.pending_tail_len(), 2);

        let flushed = decoder.flush_lossy_tail();
        assert_eq!(flushed, Some("�".to_string()));
        assert_eq!(decoder.pending_tail_len(), 0);
    }

    #[test]
    fn test_stats_tracking() {
        let mut decoder = Utf8StreamDecoder::new();

        let _ = decoder.decode_chunk(&[0xFF]); // invalid middle
        let _ = decoder.decode_chunk(&[0xE4, 0xBD]); // incomplete tail

        let stats = decoder.stats();
        assert_eq!(stats.decoded_chunks, 2);
        assert_eq!(stats.dropped_invalid_bytes, 1);
        assert_eq!(stats.incomplete_tail_events, 1);
    }

    #[test]
    fn test_empty_chunk_handling() {
        let mut decoder = Utf8StreamDecoder::new();
        let result = decoder.decode_chunk(&[]);

        assert_eq!(result.text, "");
        assert_eq!(result.dropped_invalid_bytes, 0);
        assert!(!result.had_incomplete_tail);
        assert_eq!(result.pending_tail_len, 0);
    }

    #[test]
    fn test_multiple_invalid_sequences() {
        let mut decoder = Utf8StreamDecoder::new();
        let result = decoder.decode_chunk(&[b'A', 0xFF, b'B', 0xFE, b'C']);

        assert!(result.text.contains('A'));
        assert!(result.text.contains('B'));
        assert!(result.text.contains('C'));
        assert_eq!(result.dropped_invalid_bytes, 2);
    }
}
