interface FAQItemProps {
  question: string;
  answer: string;
}

export function FAQItem({ question, answer }: FAQItemProps) {
  return (
    <div className="rounded-lg bg-accent-50 p-4 dark:bg-accent-900">
      <h3 className="font-semibold text-accent-900 dark:text-accent-100">{question}</h3>
      <p className="mt-2 text-sm text-accent-600 dark:text-accent-400">{answer}</p>
    </div>
  );
}
