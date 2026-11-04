import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export type ClassName = ClassValue;

export function cn(...className: ClassName[]) {
  return twMerge(clsx(className));
}

const isBoolean = (maybeBoolean: unknown): maybeBoolean is boolean =>
  typeof maybeBoolean === "boolean";

const toStringIfBoolean = (value: unknown) => (isBoolean(value) ? String(value) : value);

function isSimpleSubset<SchemaVariants extends Variants>(
  a: Omit<CompoundVariant<SchemaVariants>, "classes">,
  b: Options<SchemaVariants>,
) {
  return Object.entries(a).every(([key, value]) => {
    // SAFETY: Removing classes from CompoundVariant leaves only keys supplied by the variant schema.
    return b[key as keyof SchemaVariants] === value;
  });
}

type Variants = {
  [key: string]: {
    [key: string]: string;
  };
};

type CompoundVariant<SchemaVariants extends Variants> = {
  [Key in keyof SchemaVariants]?: keyof SchemaVariants[Key];
} & {
  classes: string;
};

type Options<SchemaVariants extends Variants> = {
  [Key in keyof SchemaVariants]?: keyof SchemaVariants[Key];
};

type Schema<SchemaVariants extends Variants> = {
  base: string;
  defaultVariants: {
    [K in keyof SchemaVariants]: keyof SchemaVariants[K];
  };
  variants: SchemaVariants;
  compoundVariants: CompoundVariant<SchemaVariants>[];
};

export type VariantsFromProps<
  Props extends Record<string, unknown>,
  RequiredProps = Required<Props>,
> = {
  [Key in keyof RequiredProps]: RequiredProps[Key] extends string | symbol | number
    ? {
        [Variant in RequiredProps[Key]]: string;
      }
    : never;
};

export type VariantProps<CvaFn> = CvaFn extends (options: Options<infer T>) => string
  ? {
      [Key in keyof T]: keyof T[Key];
    }
  : never;

export const cva =
  <SchemaVariants extends Variants>(schema: Partial<Schema<SchemaVariants>> = {}) =>
  (options: Options<SchemaVariants> = {}, classNames: ClassName = []) => {
    const { base, defaultVariants = {}, variants = {}, compoundVariants = [] } = schema;

    const optionsWithUndefinedsRemoved = { ...options };

    for (const key in optionsWithUndefinedsRemoved) {
      if (
        Object.hasOwn(optionsWithUndefinedsRemoved, key) &&
        optionsWithUndefinedsRemoved[key] === undefined
      ) {
        delete optionsWithUndefinedsRemoved[key];
      }
    }

    const currentOptions = {
      ...defaultVariants,
      ...optionsWithUndefinedsRemoved,
    };

    return cn([
      base,
      Object.keys(variants).map((variantName) => {
        // @ts-expect-error - idc about the types
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return variants[variantName][
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          toStringIfBoolean(options[variantName]) ||
            // @ts-expect-error - idc about the types
            defaultVariants[variantName]
        ];
      }),
      compoundVariants.reduce((list, { classes, ...compoundVariantOptions }) => {
        if (isSimpleSubset<SchemaVariants>(compoundVariantOptions, currentOptions)) {
          list.push(classes);
        }

        return list;
      }, [] as string[]),
      classNames,
    ]);
  };
