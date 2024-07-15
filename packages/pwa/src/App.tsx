function App() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-8">
      <p>Vite SPA app generated with the `create-horus` generator.</p>
      <p>
        Use TailwindCSS to style your app. `accent`, `danger`, `success`,
        `warning` are the color tokens you can use in your CSS. Some examples:
      </p>
      <div className="w-40 rounded-lg bg-accent-500 p-4 text-accent-50 dark:bg-accent-600">
        This is an example of a component styled with TailwindCSS.
      </div>
      <div className="rounded-lg bg-warning-400 p-4 font-semibold text-warning-950 dark:bg-warning-500">
        Found a bug? Please report it!
      </div>
    </div>
  );
}

export default App;
