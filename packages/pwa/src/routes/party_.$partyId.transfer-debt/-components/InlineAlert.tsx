import { Alert, AlertDescription, AlertTitle } from "#src/ui/Alert.tsx";
import { Icon } from "#src/ui/Icon.tsx";

export function InlineAlert({ title, description }: { title: string; description: string }) {
  return (
    <div className="container px-4 pt-4">
      <Alert variant="default">
        <Icon icon="lucide.badge-info" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </Alert>
    </div>
  );
}
