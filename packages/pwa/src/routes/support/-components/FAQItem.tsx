interface FAQItemProps {
  question: string;
  answer: string;
}

export function FAQItem({ question, answer }: FAQItemProps) {
  return (
    <div className="rounded-lg bg-neutral-50 p-4 dark:bg-neutral-900">
      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{question}</h3>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{answer}</p>
    </div>
  );
}
