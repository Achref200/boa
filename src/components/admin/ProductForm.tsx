'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { IconAlert, IconPlus, IconTrash } from '@/components/ui/icons';
import { saveProductAction } from '@/modules/admin/actions/products';
import { cn } from '@/lib/cn';

const LOCALES = [
  { code: 'FR', label: 'Français' },
  { code: 'EN', label: 'English' },
  { code: 'AR', label: 'العربية' },
] as const;

type LocaleCode = (typeof LOCALES)[number]['code'];

export type TranslationState = {
  locale: LocaleCode;
  name: string;
  tagline: string;
  description: string;
  usage: string;
  composition: string;
  precautions: string;
  storage: string;
  metaTitle: string;
  metaDescription: string;
};

export type VariantState = {
  key: string;
  id?: string;
  sku: string;
  format: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  lowStockAt: string;
  allowBackorder: boolean;
  isActive: boolean;
};

export type ProductFormValues = {
  id?: string;
  slug: string;
  reference: string;
  categoryId: string;
  state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isFeatured: boolean;
  isProfessional: boolean;
  position: string;
  needIds: string[];
  translations: TranslationState[];
  variants: VariantState[];
};

const FIELD_MESSAGES: Record<string, string> = {
  invalid_slug: 'Utilisez des minuscules, des chiffres et des tirets.',
  invalid_price: 'Prix invalide : jusqu’à trois décimales (ex. 19.900).',
  invalid_sku: 'SKU invalide : lettres, chiffres, points, tirets.',
  slug_taken: 'Ce slug est déjà utilisé par un autre produit.',
  duplicate_sku: 'Deux formats portent le même SKU.',
  at_least_one_variant: 'Ajoutez au moins un format.',
};

/**
 * One form, grouped into the four questions an administrator is actually
 * answering: what is it, what does it say, what can be bought, and who is it
 * for. A single 40-field page would be unusable; four separate wizard steps
 * would make a two-word tagline fix a four-page task.
 *
 * The locale tabs share one submit: publishing a product with a French name and
 * no Arabic name is legitimate (the storefront falls back), but saving them
 * apart would let the three languages drift out of one transaction.
 */
export function ProductForm({
  initial,
  categories,
  needs,
  canPublish,
  redirectTo,
}: {
  initial: ProductFormValues;
  categories: { id: string; name: string }[];
  needs: { id: string; name: string }[];
  canPublish: boolean;
  redirectTo: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);
  const [activeLocale, setActiveLocale] = useState<LocaleCode>('FR');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const translation =
    values.translations.find((entry) => entry.locale === activeLocale) ?? values.translations[0]!;

  const patchTranslation = (patch: Partial<TranslationState>) =>
    setValues((current) => ({
      ...current,
      translations: current.translations.map((entry) =>
        entry.locale === activeLocale ? { ...entry, ...patch } : entry,
      ),
    }));

  const patchVariant = (key: string, patch: Partial<VariantState>) =>
    setValues((current) => ({
      ...current,
      variants: current.variants.map((variant) =>
        variant.key === key ? { ...variant, ...patch } : variant,
      ),
    }));

  const addVariant = () =>
    setValues((current) => ({
      ...current,
      variants: [
        ...current.variants,
        {
          key: `new-${current.variants.length}-${Date.now()}`,
          sku: '',
          format: '',
          price: '',
          compareAtPrice: '',
          stock: '0',
          lowStockAt: '5',
          allowBackorder: false,
          isActive: true,
        },
      ],
    }));

  const removeVariant = (key: string) =>
    setValues((current) => ({
      ...current,
      variants: current.variants.filter((variant) => variant.key !== key),
    }));

  const message = (path: string) => {
    const code = errors[path]?.[0];
    return code ? (FIELD_MESSAGES[code] ?? 'Valeur invalide.') : undefined;
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await saveProductAction({
        id: values.id,
        slug: values.slug,
        reference: values.reference,
        categoryId: values.categoryId,
        state: values.state,
        isFeatured: values.isFeatured,
        isProfessional: values.isProfessional,
        position: values.position,
        needIds: values.needIds,
        translations: values.translations
          .filter((entry) => entry.name.trim() !== '')
          .map((entry) => ({ ...entry })),
        variants: values.variants.map((variant, index) => ({
          id: variant.id,
          sku: variant.sku,
          format: variant.format,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          stock: variant.stock,
          lowStockAt: variant.lowStockAt,
          allowBackorder: variant.allowBackorder,
          isActive: variant.isActive,
          position: index,
        })),
      });

      if (result.ok) {
        setErrors({});
        setSaved(true);
        if (!values.id) router.replace(`${redirectTo}/${result.data.id}`);
        else router.refresh();
        return;
      }

      setErrors(result.fieldErrors ?? {});
      setFormError(
        result.code === 'forbidden'
          ? 'Vous n’avez pas les droits nécessaires.'
          : result.code === 'conflict'
            ? (FIELD_MESSAGES[result.message] ?? 'Conflit de données.')
            : result.code === 'validation_failed'
              ? (FIELD_MESSAGES[result.message] ?? 'Vérifiez les champs signalés.')
              : 'Enregistrement impossible pour le moment.',
      );
      document.getElementById('product-form-error')?.focus();
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-8">
      {formError ? (
        <p
          id="product-form-error"
          role="alert"
          tabIndex={-1}
          className="flex items-start gap-3 border border-[var(--color-critical)] bg-[var(--surface-raised)] px-4 py-3 text-sm"
        >
          <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-critical)]" />
          {formError}
        </p>
      ) : null}

      {saved ? (
        <p role="status" className="border border-[var(--color-positive)] bg-[var(--surface-raised)] px-4 py-3 text-sm">
          Modifications enregistrées.
        </p>
      ) : null}

      <Section title="Identité">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="slug"
            label="Slug (URL)"
            value={values.slug}
            onChange={(event) => setValues((c) => ({ ...c, slug: event.target.value }))}
            required
            hint="Apparaît dans l’adresse : /produits/mon-produit"
            error={message('slug')}
          />
          <TextField
            id="reference"
            label="Référence interne"
            value={values.reference}
            onChange={(event) => setValues((c) => ({ ...c, reference: event.target.value }))}
            optional
            optionalLabel="facultatif"
          />
          <SelectField
            id="categoryId"
            label="Catégorie"
            value={values.categoryId}
            onChange={(event) => setValues((c) => ({ ...c, categoryId: event.target.value }))}
          >
            <option value="">—</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="state"
            label="État"
            value={values.state}
            onChange={(event) =>
              setValues((c) => ({ ...c, state: event.target.value as ProductFormValues['state'] }))
            }
          >
            <option value="DRAFT">Brouillon</option>
            <option value="PUBLISHED" disabled={!canPublish}>
              Publié
            </option>
            <option value="ARCHIVED">Archivé</option>
          </SelectField>
        </div>

        <div className="mt-5 flex flex-wrap gap-6">
          <Toggle
            id="isFeatured"
            label="Produit signature"
            hint="Mis en avant sur la page d’accueil"
            checked={values.isFeatured}
            onChange={(checked) => setValues((c) => ({ ...c, isFeatured: checked }))}
          />
          <Toggle
            id="isProfessional"
            label="Format professionnel"
            hint="Masqué du catalogue grand public"
            checked={values.isProfessional}
            onChange={(checked) => setValues((c) => ({ ...c, isProfessional: checked }))}
          />
        </div>
      </Section>

      <Section
        title="Contenu"
        description="Les champs laissés vides ne sont pas affichés sur la fiche produit — rien n’est inventé à leur place."
      >
        <div role="tablist" aria-label="Langue du contenu" className="mb-6 flex gap-2">
          {LOCALES.map((locale) => {
            const filled = values.translations.find((entry) => entry.locale === locale.code)?.name.trim();
            return (
              <button
                key={locale.code}
                type="button"
                role="tab"
                aria-selected={activeLocale === locale.code}
                onClick={() => setActiveLocale(locale.code)}
                className={cn(
                  'inline-flex min-h-10 items-center gap-2 border px-4 text-xs uppercase tracking-[0.12em] transition-colors',
                  activeLocale === locale.code
                    ? 'border-[var(--surface-fg)] bg-[var(--surface-fg)] text-[var(--surface-bg)]'
                    : 'border-[var(--surface-line)] hover:border-[var(--surface-fg)]',
                )}
              >
                {locale.label}
                <span
                  className={cn('size-1.5 rounded-full', filled ? 'bg-[var(--color-positive)]' : 'bg-[var(--surface-line)]')}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>

        <div className="grid gap-5">
          <TextField
            id={`name-${activeLocale}`}
            label="Nom"
            value={translation.name}
            onChange={(event) => patchTranslation({ name: event.target.value })}
            required={activeLocale === 'FR'}
            error={message('translations.0.name')}
          />
          <TextField
            id={`tagline-${activeLocale}`}
            label="Accroche"
            value={translation.tagline}
            onChange={(event) => patchTranslation({ tagline: event.target.value })}
            optional
            optionalLabel="facultatif"
          />
          <TextAreaField
            id={`description-${activeLocale}`}
            label="À quoi ça sert"
            value={translation.description}
            onChange={(event) => patchTranslation({ description: event.target.value })}
            optional
            optionalLabel="facultatif"
            rows={5}
          />
          <TextAreaField
            id={`usage-${activeLocale}`}
            label="Comment l’utiliser"
            value={translation.usage}
            onChange={(event) => patchTranslation({ usage: event.target.value })}
            optional
            optionalLabel="facultatif"
          />
          <TextAreaField
            id={`composition-${activeLocale}`}
            label="Composition"
            value={translation.composition}
            onChange={(event) => patchTranslation({ composition: event.target.value })}
            optional
            optionalLabel="facultatif"
            hint="Reprenez la liste exacte figurant sur le packaging."
          />
          <TextAreaField
            id={`precautions-${activeLocale}`}
            label="Précautions"
            value={translation.precautions}
            onChange={(event) => patchTranslation({ precautions: event.target.value })}
            optional
            optionalLabel="facultatif"
          />
          <TextAreaField
            id={`storage-${activeLocale}`}
            label="Format et conservation"
            value={translation.storage}
            onChange={(event) => patchTranslation({ storage: event.target.value })}
            optional
            optionalLabel="facultatif"
          />

          <details className="border-t border-[var(--surface-line)] pt-4">
            <summary className="cursor-pointer text-xs uppercase tracking-[0.1em] text-[var(--surface-muted)]">
              Référencement (SEO)
            </summary>
            <div className="mt-4 grid gap-5">
              <TextField
                id={`metaTitle-${activeLocale}`}
                label="Titre de la page"
                value={translation.metaTitle}
                onChange={(event) => patchTranslation({ metaTitle: event.target.value })}
                optional
                optionalLabel="facultatif"
                hint="Par défaut, le nom du produit."
              />
              <TextAreaField
                id={`metaDescription-${activeLocale}`}
                label="Description pour les moteurs"
                value={translation.metaDescription}
                onChange={(event) => patchTranslation({ metaDescription: event.target.value })}
                optional
                optionalLabel="facultatif"
                rows={2}
              />
            </div>
          </details>
        </div>
      </Section>

      <Section
        title="Formats et prix"
        description="Chaque format est une unité achetable, avec son propre SKU, prix et stock."
      >
        <ul className="flex flex-col gap-4">
          {values.variants.map((variant, index) => (
            <li key={variant.key} className="rounded-md border border-[var(--surface-line)] p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <TextField
                  id={`format-${variant.key}`}
                  label="Format"
                  value={variant.format}
                  onChange={(event) => patchVariant(variant.key, { format: event.target.value })}
                  placeholder="250 ml"
                  required
                  error={message(`variants.${index}.format`)}
                />
                <TextField
                  id={`sku-${variant.key}`}
                  label="SKU"
                  value={variant.sku}
                  onChange={(event) => patchVariant(variant.key, { sku: event.target.value })}
                  required
                  error={message(`variants.${index}.sku`)}
                />
                <TextField
                  id={`price-${variant.key}`}
                  label="Prix (DT)"
                  value={variant.price}
                  onChange={(event) => patchVariant(variant.key, { price: event.target.value })}
                  inputMode="decimal"
                  placeholder="19.900"
                  required
                  error={message(`variants.${index}.price`)}
                />
                <TextField
                  id={`compare-${variant.key}`}
                  label="Prix barré"
                  value={variant.compareAtPrice}
                  onChange={(event) => patchVariant(variant.key, { compareAtPrice: event.target.value })}
                  inputMode="decimal"
                  optional
                  optionalLabel="facultatif"
                  error={message(`variants.${index}.compareAtPrice`)}
                />
                <TextField
                  id={`stock-${variant.key}`}
                  label="Stock"
                  value={variant.stock}
                  onChange={(event) => patchVariant(variant.key, { stock: event.target.value })}
                  inputMode="numeric"
                  required
                  error={message(`variants.${index}.stock`)}
                />
                <TextField
                  id={`low-${variant.key}`}
                  label="Seuil d’alerte"
                  value={variant.lowStockAt}
                  onChange={(event) => patchVariant(variant.key, { lowStockAt: event.target.value })}
                  inputMode="numeric"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-6">
                <Toggle
                  id={`active-${variant.key}`}
                  label="Actif"
                  checked={variant.isActive}
                  onChange={(checked) => patchVariant(variant.key, { isActive: checked })}
                />
                <Toggle
                  id={`backorder-${variant.key}`}
                  label="Vente sans stock"
                  hint="Permet de commander même à zéro"
                  checked={variant.allowBackorder}
                  onChange={(checked) => patchVariant(variant.key, { allowBackorder: checked })}
                />
                {values.variants.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeVariant(variant.key)}
                    className="ms-auto inline-flex min-h-10 items-center gap-2 text-xs text-[var(--surface-muted)] hover:text-[var(--color-critical)]"
                  >
                    <IconTrash width={14} height={14} />
                    Retirer ce format
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={addVariant}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--surface-line)] px-4 text-sm font-semibold hover:border-[var(--surface-fg)]"
        >
          <IconPlus width={14} height={14} />
          Ajouter un format
        </button>

        <p className="mt-4 text-xs text-[var(--surface-muted)]">
          Un format déjà commandé n’est jamais supprimé : il est désactivé, pour que les commandes
          passées restent lisibles.
        </p>
      </Section>

      {needs.length > 0 ? (
        <Section title="Besoins" description="Utilisés par les filtres et par le bloc « Par besoin » de l’accueil.">
          <ul className="flex flex-wrap gap-2">
            {needs.map((need) => {
              const checked = values.needIds.includes(need.id);
              return (
                <li key={need.id}>
                  <label
                    className={cn(
                      'inline-flex min-h-11 cursor-pointer items-center gap-2 border px-4 text-sm transition-colors',
                      checked
                        ? 'border-[var(--surface-fg)] bg-[var(--surface-fg)] text-[var(--surface-bg)]'
                        : 'border-[var(--surface-line)] hover:border-[var(--surface-fg)]',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setValues((current) => ({
                          ...current,
                          needIds: checked
                            ? current.needIds.filter((id) => id !== need.id)
                            : [...current.needIds, need.id],
                        }))
                      }
                      className="visually-hidden"
                    />
                    {need.name}
                  </label>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-4 border-t border-[var(--surface-line)] bg-[var(--surface-raised)] px-4 py-4 sm:-mx-8 sm:px-8">
        <Button type="submit" size="lg" loading={pending}>
          {values.id ? 'Enregistrer' : 'Créer le produit'}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)]">
      <header className="border-b border-[var(--surface-line)] px-5 py-3">
        <h2 className="lockup text-[var(--surface-muted)]">{title}</h2>
        {description ? (
          <p className="mt-2 text-xs text-[var(--surface-muted)]">{description}</p>
        ) : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 shrink-0 appearance-none rounded-[4px] border border-[var(--surface-field-line)] checked:border-[var(--surface-fg)] checked:bg-[var(--surface-fg)]"
      />
      <span>
        <span className="block text-sm">{label}</span>
        {hint ? <span className="block text-xs text-[var(--surface-muted)]">{hint}</span> : null}
      </span>
    </label>
  );
}
