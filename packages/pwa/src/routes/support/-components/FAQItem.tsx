interface FAQItemProps {
  question: string;
  answer: string;
}

export function FAQItem({ question, answer }: FAQItemProps) {
  return (
    <div className="bg-accent-50 dark:bg-accent-900 rounded-lg p-4">
      <h3 className="text-accent-900 dark:text-accent-100 font-semibold">{question}</h3>
      <p className="text-accent-600 dark:text-accent-400 mt-2 text-sm">{answer}</p>
    </div>
  );
}
