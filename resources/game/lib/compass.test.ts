import { describe, it, expect } from 'vitest';
import { compass } from './compass';

describe('compass', () => {
    it('maps screen-space vectors to compass words (y points down)', () => {
        expect(compass(1, 0)).toBe('east');
        expect(compass(-1, 0)).toBe('west');
        expect(compass(0, -1)).toBe('north'); // up on screen
        expect(compass(0, 1)).toBe('south'); // down on screen
        expect(compass(1, -1)).toBe('north-east');
        expect(compass(-1, 1)).toBe('south-west');
    });
});
