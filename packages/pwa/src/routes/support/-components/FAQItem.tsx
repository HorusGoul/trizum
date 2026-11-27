interface FAQItemProps {
  question: string;
  answer: string;
}

export function FAQItem({ question, answer }: FAQItemProps) {
  return (
    <div className="shadow-surface rounded-3xl bg-white p-5 dark:bg-neutral-900">
      <h3 className="font-semibold text-neutral-950 dark:text-neutral-50">{question}</h3>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{answer}</p>
    </div>
  );
}
