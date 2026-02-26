import { isWsOutputMessage, isWsErrorMessage } from '../websocket';

describe('WebSocket Type Guards', () => {
    describe('isWsOutputMessage', () => {
        it('should return true for valid output message', () => {
            const msg = { type: 'output', data: 'test output' };
            expect(isWsOutputMessage(msg)).toBe(true);
        });

        it('should return false for error message', () => {
            const msg = { type: 'error', message: 'test error' };
            expect(isWsOutputMessage(msg)).toBe(false);
        });

        it('should return false for input message', () => {
            const msg = { type: 'input', data: 'input' };
            expect(isWsOutputMessage(msg)).toBe(false);
        });

        it('should return false for invalid structure', () => {
            const msg = { type: 'output' }; // missing data
            expect(isWsOutputMessage(msg)).toBe(false);
        });

        it('should return false for non-string output data', () => {
            const msg = { type: 'output', data: 123 };
            expect(isWsOutputMessage(msg)).toBe(false);
        });

        it('should return false for non-object', () => {
            expect(isWsOutputMessage(null)).toBe(false);
            expect(isWsOutputMessage('string')).toBe(false);
            expect(isWsOutputMessage(123)).toBe(false);
        });
    });

    describe('isWsErrorMessage', () => {
        it('should return true for valid error message', () => {
            const msg = { type: 'error', message: 'error occurred' };
            expect(isWsErrorMessage(msg)).toBe(true);
        });

        it('should return false for output message', () => {
            const msg = { type: 'output', data: 'output' };
            expect(isWsErrorMessage(msg)).toBe(false);
        });

        it('should return false for missing message field', () => {
            const msg = { type: 'error' }; // missing message
            expect(isWsErrorMessage(msg)).toBe(false);
        });

        it('should return false for non-string error message', () => {
            const msg = { type: 'error', message: 123 };
            expect(isWsErrorMessage(msg)).toBe(false);
        });

        it('should return false for non-object', () => {
            expect(isWsErrorMessage(null)).toBe(false);
            expect(isWsErrorMessage('string')).toBe(false);
            expect(isWsErrorMessage(123)).toBe(false);
        });
    });
});
