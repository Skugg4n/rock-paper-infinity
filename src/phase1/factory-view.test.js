/* eslint-env jest */
import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { createFactoryView, cellPosition, FACTORY_TILES } from './factory-view.js';

let tiles;

beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.document = dom.window.document;
    tiles = Array.from({ length: FACTORY_TILES }, () => {
        const el = document.createElement('div');
        el.innerHTML = '<span>old board content</span>';
        document.body.appendChild(el);
        return el;
    });
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('the factory: boards all the way down', () => {
    test('cellPosition covers the 9 x 9 whole exactly once', () => {
        const seen = new Set();
        for (let t = 0; t < 9; t++) for (let c = 0; c < 9; c++) {
            const { x, y } = cellPosition(t, c);
            expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(8);
            expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(8);
            seen.add(`${x},${y}`);
        }
        expect(seen.size).toBe(81);
        expect(cellPosition(0, 0)).toEqual({ x: 0, y: 0 });
        expect(cellPosition(8, 8)).toEqual({ x: 8, y: 8 });
        expect(cellPosition(4, 4)).toEqual({ x: 4, y: 4 });
    });

    test('every board becomes a tile of nine cells and loses its old content', () => {
        const view = createFactoryView(tiles);
        expect(view.cells).toHaveLength(81);
        for (const tile of tiles) {
            expect(tile.classList.contains('factory-tile')).toBe(true);
            expect(tile.querySelectorAll('.factory-cell')).toHaveLength(9);
            expect(tile.textContent).not.toContain('old board content');
        }
    });

    test('a tick lights cells and they go out again', () => {
        const view = createFactoryView(tiles, { random: () => 0.3 });
        view.tick();
        expect(document.querySelectorAll('.factory-cell.play').length).toBeGreaterThan(0);
        expect(document.querySelectorAll('.factory-cell.won').length).toBe(1);
        jest.advanceTimersByTime(400);
        expect(document.querySelectorAll('.factory-cell.play, .factory-cell.won').length).toBe(0);
    });

    test('a wave reaches every cell, the origin first', () => {
        const view = createFactoryView(tiles);
        view.wave(0, 0);
        jest.advanceTimersByTime(1);
        const first = view.cells.find((c) => c.x === 0 && c.y === 0);
        const last = view.cells.find((c) => c.x === 8 && c.y === 8);
        expect(first.el.classList.contains('won')).toBe(true);
        expect(last.el.classList.contains('won')).toBe(false);
        jest.advanceTimersByTime(Math.hypot(8, 8) * 75 + 5);
        expect(last.el.classList.contains('won')).toBe(true);
        jest.advanceTimersByTime(300);
        expect(document.querySelectorAll('.factory-cell.won').length).toBe(0);
    });

    test('destroy cancels what is pending', () => {
        const view = createFactoryView(tiles);
        view.wave(0, 0);
        view.destroy();
        jest.advanceTimersByTime(2000);
        expect(document.querySelectorAll('.factory-cell.won').length).toBe(0);
    });
});
