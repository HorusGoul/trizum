export function focusInputIntoView(input: HTMLInputElement) {
  input.focus();

  const rect = input.getBoundingClientRect();
  const margin = 10;

  if (
    rect.top >= margin &&
    rect.left >= margin &&
    rect.right <= window.innerWidth - margin &&
    rect.bottom <= window.innerHeight - margin
  ) {
    return;
  }

  window.scrollTo({
    behavior: "smooth",
    top: window.scrollY + rect.top,
    left: window.scrollX + rect.left,
  });
}
