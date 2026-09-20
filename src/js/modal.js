/*
 * Project detail modals, built on the native <dialog> element.
 *
 * showModal() gives us the focus trap, the inert page behind, and focus
 * return on close. This module adds what <dialog> lacks: closing on a
 * backdrop click, locking page scroll, and an exit animation.
 */
const SCROLL_LOCK_CLASS = 'is-scroll-locked';
const CLOSING_CLASS = 'is-closing';
// Longer than the CSS exit animation; closes anyway if animationend is lost.
const CLOSE_FALLBACK_MS = 400;

function open(dialog) {
  dialog.showModal();
  document.documentElement.classList.add(SCROLL_LOCK_CLASS);
  const closeButton = dialog.querySelector('[data-modal-close]');
  if (closeButton) {
    closeButton.focus();
  }
}

function requestClose(dialog) {
  if (dialog.classList.contains(CLOSING_CLASS)) {
    return;
  }

  let fallbackTimer = 0;

  // The dialog's exit animation and its backdrop's run for the same time, so
  // whichever reports first is the signal to close.
  function finish(event) {
    if (event && event.target !== dialog) {
      return;
    }
    dialog.removeEventListener('animationend', finish);
    window.clearTimeout(fallbackTimer);
    dialog.classList.remove(CLOSING_CLASS);
    dialog.close();
  }

  dialog.classList.add(CLOSING_CLASS);
  dialog.addEventListener('animationend', finish);
  fallbackTimer = window.setTimeout(finish, CLOSE_FALLBACK_MS);
}

function bind(dialog) {
  // Escape fires "cancel" and would close instantly; route it through the
  // same animated close as every other path.
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    requestClose(dialog);
  });

  // The panel fills the dialog box, so a click whose target is the dialog
  // itself can only have landed on the backdrop.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      requestClose(dialog);
    }
  });

  dialog.querySelectorAll('[data-modal-close]').forEach((button) => {
    button.addEventListener('click', () => requestClose(dialog));
  });

  // Every close path ends here, so the scroll lock can never be left behind.
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove(SCROLL_LOCK_CLASS);
  });
}

export function initModals() {
  document.querySelectorAll('[data-modal-open]').forEach((opener) => {
    const dialog = document.getElementById(opener.dataset.modalOpen);
    if (!dialog || typeof dialog.showModal !== 'function') {
      return;
    }
    opener.addEventListener('click', () => open(dialog));
  });

  document.querySelectorAll('dialog.modal').forEach(bind);
}
