use services::git_watcher::commit_parser::{parse_commit_metadata, CommitMetadata};

fn main() {
    // Test 1: Empty commit message
    println!("Test 1: Empty commit message");
    let result = parse_commit_metadata("");
    println!("Result: {:?}", result.is_err());
    
    // Test 2: Separator only
    println!("\nTest 2: Separator only");
    let result = parse_commit_metadata("---METADATA---");
    println!("Result: {:?}", result.is_err());
    
    // Test 3: Multiple separators (should use first)
    println!("\nTest 3: Multiple separators");
    let msg = "---METADATA---{\"workflowId\":\"wf-123\",\"taskId\":\"task-456\",\"terminalId\":\"term-789\",\"status\":\"completed\",\"reviewedTerminal\":null,\"issues\":null,\"filesChanged\":[]}\n---METADATA---";
    let result = parse_commit_metadata(msg);
    println!("Result: {:?}", result.is_ok());
    
    // Test 4: Empty JSON fields
    println!("\nTest 4: Empty workflow_id");
    let msg = "---METADATA---{\"workflowId\":\"\",\"taskId\":\"task-456\",\"terminalId\":\"term-789\",\"status\":\"completed\",\"reviewedTerminal\":null,\"issues\":null,\"filesChanged\":[]}";
    let result = parse_commit_metadata(msg);
    println!("Result: {:?}", result.is_err());
    
    // Test 5: Unicode in message
    println!("\nTest 5: Unicode characters");
    let msg = "🚀 Feature\n\n---METADATA---\n{\"workflowId\":\"wf-123\",\"taskId\":\"task-456\",\"terminalId\":\"term-789\",\"status\":\"completed\",\"reviewedTerminal\":null,\"issues\":null,\"filesChanged\":[]}";
    let result = parse_commit_metadata(msg);
    println!("Result: {:?}", result.is_ok());
    
    // Test 6: Very long line before separator
    println!("\nTest 6: Very long message");
    let long_msg = "A".repeat(10000);
    let msg = format!("{}\n---METADATA---\n{{\"workflowId\":\"wf-123\",\"taskId\":\"task-456\",\"terminalId\":\"term-789\",\"status\":\"completed\",\"reviewedTerminal\":null,\"issues\":null,\"filesChanged\":[]}}", long_msg);
    let result = parse_commit_metadata(&msg);
    println!("Result: {:?}", result.is_ok());
    
    // Test 7: JSON with whitespace
    println!("\nTest 7: JSON with extra whitespace");
    let msg = "---METADATA---\n  {\"workflowId\":\"wf-123\",\"taskId\":\"task-456\",\"terminalId\":\"term-789\",\"status\":\"completed\",\"reviewedTerminal\":null,\"issues\":null,\"filesChanged\":[]}\n  ";
    let result = parse_commit_metadata(msg);
    println!("Result: {:?}", result.is_ok());
    
    println!("\n✅ All edge case tests completed");
}
