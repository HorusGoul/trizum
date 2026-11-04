import { z } from "zod";

const authDateSchema = z
  .union([
    z.date(),
    z.string().transform((value) => {
      const date = new Date(value);

      return Number.isNaN(date.getTime()) ? new Date(0) : date;
    }),
  ])
  .catch(() => new Date(0));

const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.string(),
  name: z.string().catch(""),
  emailVerified: z.boolean().catch(false),
  image: z.string().nullable().catch(null),
  createdAt: authDateSchema,
  updatedAt: authDateSchema,
});

/** Decode public user fields; session secrets and arbitrary response fields are discarded. */
const getAuthResultUserSchema = z
  .object({ user: authUserSchema })
  .transform((result) => result.user)
  .optional()
  .catch(undefined);

export const getAuthResultUser = getAuthResultUserSchema.parse.bind(getAuthResultUserSchema);

const getAuthRedirectUrlSchema = z
  .object({ url: z.string() })
  .transform((result) => result.url)
  .optional()
  .catch(undefined);

export const getAuthRedirectUrl = getAuthRedirectUrlSchema.parse.bind(getAuthRedirectUrlSchema);

const getAuthResultTokenSchema = z
  .object({ token: z.string() })
  .transform((result) => result.token)
  .optional()
  .catch(undefined);

export const getAuthResultToken = getAuthResultTokenSchema.parse.bind(getAuthResultTokenSchema);

const readRememberedAuthUserSchema = z
  .union([z.object({ user: authUserSchema }).transform((result) => result.user), authUserSchema])
  .nullable()
  .catch(null);

export const readRememberedAuthUser = readRememberedAuthUserSchema.parse.bind(
  readRememberedAuthUserSchema,
);
