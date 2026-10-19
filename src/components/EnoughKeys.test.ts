import { createElement, isValidElement, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnoughKeys } from './EnoughKeys';

const style = { left: '50%', top: '40%' };

describe('the silent machine: Enough? and Enough. together', () => {
  it('shows both keys at once, Enough? above Enough., both pressable', () => {
    const html = renderToString(createElement(EnoughKeys, { style, onLastDrop: () => {}, onSecretBlend: () => {} }));
    const keys = [...html.matchAll(/<button[^>]*class="([^"]*)"[^>]*>.*?<span class="more-key__cap">([^<]*)<\/span><\/button>/g)];
    expect(keys.map((k) => k[2])).toEqual(['Enough?', 'Enough.']);
    for (const [, cls] of keys) expect(cls).toContain('is-shown');
    // The second stands beneath the first.
    expect(keys[0][1]).not.toContain('more-key--below');
    expect(keys[1][1]).toContain('more-key--below');
  });

  it('each key triggers only its own action', () => {
    const onLastDrop = vi.fn();
    const onSecretBlend = vi.fn();
    const tree = EnoughKeys({ style, onLastDrop, onSecretBlend }) as ReactElement<{ children: ReactElement[] }>;
    const [ask, done] = tree.props.children as unknown as [
      ReactElement<{ label: string; onPress: () => void }>,
      ReactElement<{ label: string; onPress: () => void }>,
    ];
    expect(isValidElement(ask) && isValidElement(done)).toBe(true);
    expect([ask.props.label, done.props.label]).toEqual(['Enough?', 'Enough.']);
    ask.props.onPress();
    expect(onLastDrop).toHaveBeenCalledTimes(1);
    expect(onSecretBlend).not.toHaveBeenCalled();
    done.props.onPress();
    expect(onSecretBlend).toHaveBeenCalledTimes(1);
    expect(onLastDrop).toHaveBeenCalledTimes(1);
  });

  it('the silent screen holds exactly the two keys: no ? disc', () => {
    const html = renderToString(createElement(EnoughKeys, { style, onLastDrop: () => {}, onSecretBlend: () => {} }));
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).not.toContain('casing__puzzle');
    const tree = EnoughKeys({ style, onLastDrop: () => {}, onSecretBlend: () => {} }) as ReactElement<{ children: ReactElement[] }>;
    expect(tree.props.children).toHaveLength(2);
  });
});
