import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { Suspense, useId, useState } from "react";
import { toast } from "sonner";
import { BackButton } from "#src/components/BackButton.js";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { IconButton } from "#src/ui/IconButton.js";
import { AppTextField } from "#src/ui/fields/TextField.js";
import { resetPasswordWithToken } from "#src/lib/auth-client.ts";

interface ResetPasswordSearchParams {
  error?: string;
  token?: string;
}

interface ResetPasswordFormValues {
  password: string;
}

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  validateSearch: (search: Record<string, unknown>): ResetPasswordSearchParams => ({
    error: typeof search.error === "string" ? search.error : undefined,
    token: typeof search.token === "string" ? search.token : undefined,
  }),
});

function ResetPassword() {
  const { error, token } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formId = useId();

  const form = useForm({
    defaultValues: {
      password: "",
    },
    onSubmit: async ({ value }) => {
      if (!token) {
        toast.error(t`Password reset link is invalid or expired`);
        return;
      }

      setIsSubmitting(true);

      try {
        await resetPasswordWithToken({
          newPassword: value.password,
          token,
        });
        toast.success(t`Password updated`);
        void navigate({ to: "/settings", replace: true });
      } catch {
        toast.error(t`Could not reset password`);
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/settings" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Reset password</Trans>
        </h1>

        <div className="flex-1" />

        {token ? (
          <Suspense fallback={null}>
            <IconButton
              icon="lucide.check"
              aria-label={isSubmitting ? t`Submitting...` : t`Save`}
              type="submit"
              form={formId}
              isDisabled={isSubmitting}
            />
          </Suspense>
        ) : null}
      </div>

      <div className="container mt-4 flex flex-col gap-6 px-4 pb-8 pb-safe">
        {error || !token ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-accent-700 dark:text-accent-50">
              <Trans>Password reset link is invalid or expired.</Trans>
            </p>
            <Button
              color="accent"
              onPress={() => {
                void navigate({ to: "/settings", replace: true });
              }}
            >
              <span className="flex items-center gap-2">
                <Icon icon="lucide.arrow-left" width={18} height={18} />
                <Trans>Back to settings</Trans>
              </span>
            </Button>
          </div>
        ) : (
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
            className="flex flex-col gap-4"
          >
            <form.Field
              name="password"
              validators={{
                onChange: ({ value }) =>
                  value.length < 8 ? t`Password must be at least 8 characters` : undefined,
              }}
            >
              {(field) => (
                <AppTextField
                  isDisabled={isSubmitting}
                  label={t`New password`}
                  minLength={8}
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                  type="password"
                  value={field.state.value}
                  errorMessage={field.state.meta.errors?.join(", ")}
                  isInvalid={field.state.meta.isTouched && field.state.meta.errors?.length > 0}
                />
              )}
            </form.Field>

            <Button color="accent" isDisabled={isSubmitting} type="submit">
              <span className="flex items-center gap-2">
                <Icon icon="lucide.check" width={18} height={18} />
                <Trans>Update password</Trans>
              </span>
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
