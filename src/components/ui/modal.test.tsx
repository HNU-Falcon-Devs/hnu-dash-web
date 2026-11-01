import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './modal';

describe('Modal', () => {
  it('uses unique accessible labels for multiple dialogs', () => {
    render(<><Modal isOpen onClose={() => undefined} title="First">One</Modal><Modal isOpen onClose={() => undefined} title="Second">Two</Modal></>);
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs[0].getAttribute('aria-labelledby')).not.toBe(dialogs[1].getAttribute('aria-labelledby'));
  });

  it('closes with Escape and backdrop interaction', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal isOpen onClose={onClose} title="Settings">Content</Modal>);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(container.querySelector('[aria-hidden="true"]') as Element);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('traps focus and restores focus and body overflow after closing', () => {
    document.body.style.overflow = 'scroll';
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { rerender } = render(<Modal isOpen onClose={() => undefined} title="Actions"><button>First action</button><button>Last action</button></Modal>);
    const close = screen.getByRole('button', { name: 'Close modal' });
    const first = screen.getByRole('button', { name: 'First action' });
    const last = screen.getByRole('button', { name: 'Last action' });
    expect(close).toHaveFocus();
    last.focus(); fireEvent.keyDown(window, { key: 'Tab' }); expect(close).toHaveFocus();
    close.focus(); fireEvent.keyDown(window, { key: 'Tab', shiftKey: true }); expect(last).toHaveFocus();
    first.focus();
    rerender(<Modal isOpen={false} onClose={() => undefined} title="Actions"><button>First action</button></Modal>);
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('scroll');
    opener.remove(); document.body.style.overflow = '';
  });
});
