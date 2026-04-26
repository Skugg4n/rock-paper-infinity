import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';

let fireStarAnimation;

beforeEach(async () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        pretendToBeVisual: true,
    });
    global.document = dom.window.document;
    global.window = dom.window;

    jest.resetModules();
    const mod = await import('./star-animation.js');
    fireStarAnimation = mod.fireStarAnimation;
});

afterEach(() => {
    delete global.document;
    delete global.window;
});

// Helper: create a minimal element with a deterministic bounding rect
function makeEl(x, y, w = 40, h = 40) {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ left: x, top: y, width: w, height: h });
    return el;
}

test('appends an SVG star to document.body', () => {
    const source = makeEl(100, 200);
    const target = makeEl(10, 20);

    fireStarAnimation(source, target);

    expect(document.body.children.length).toBe(1);
    const star = document.body.children[0];
    expect(star.tagName.toLowerCase()).toBe('svg');
});

test('uses setAttribute("class") to set star-fly class', () => {
    const source = makeEl(100, 200);
    const target = makeEl(10, 20);

    fireStarAnimation(source, target);

    const star = document.body.children[0];
    expect(star.getAttribute('class')).toBe('star-fly');
});

test('sets --from-x, --from-y, --to-x, --to-y CSS custom properties', () => {
    const source = makeEl(100, 200, 40, 40);
    const target = makeEl(10, 20, 60, 30);

    fireStarAnimation(source, target);

    const star = document.body.children[0];
    // center of source minus 12 (half of 24px star)
    expect(star.style.getPropertyValue('--from-x')).toBe('108px');  // 100 + 20 - 12
    expect(star.style.getPropertyValue('--from-y')).toBe('208px');  // 200 + 20 - 12
    expect(star.style.getPropertyValue('--to-x')).toBe('28px');     // 10 + 30 - 12
    expect(star.style.getPropertyValue('--to-y')).toBe('23px');     // 20 + 15 - 12
});

test('attaches an animationend listener that removes the element', () => {
    const source = makeEl(0, 0);
    const target = makeEl(50, 50);

    fireStarAnimation(source, target);

    const star = document.body.children[0];
    expect(document.body.children.length).toBe(1);

    // Simulate animationend
    star.dispatchEvent(new global.window.Event('animationend'));
    expect(document.body.children.length).toBe(0);
});

test('does nothing when sourceEl is null', () => {
    const target = makeEl(10, 20);
    fireStarAnimation(null, target);
    expect(document.body.children.length).toBe(0);
});

test('does nothing when targetEl is null', () => {
    const source = makeEl(100, 200);
    fireStarAnimation(source, null);
    expect(document.body.children.length).toBe(0);
});
