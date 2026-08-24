'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { IconAlert } from '@/components/ui/icons';
import { saveContentBlockAction } from '@/modules/admin/actions/content';
import { cn } from '@/lib/cn';

const LOCALES = [
  { code: 'FR', label: 'Français' },
  { code: 'EN', label: 'English' },
  { code: 'AR', label: 'العربية' },
] as const;

type LocaleCode = (typeof LOCALES)[number]['code'];

type Translation = {
  locale: LocaleCode;
  eyebrow: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
};

/**
 * One band of the homepage.
 *
 * What an administrator can change is: whether it shows, where it sits, its
 * copy in three languages, and — for the opening band — which product it
 * features. What they cannot change is the band's *layout*, which is the part
 * that carries the art direction. That boundary is what keeps BOA's homepage
 * from drifting into a generic page builder.
 */
export function ContentBlockEditor({
  block,
  productOptions,
}: {
  block: {
    id: string;
    kind: string;
    label: string;
    isVisible: boolean;
    position: number;
    productSlug: string | null;
    translations: Translation[];
  };
  productOptions: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(block);
  const [activeLocale, setActiveLocale] = useState<LocaleCode>('FR');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const translation =
    values.translations.find((entry) => entry.locale === activeLocale) ?? values.translations[0]!;

  const patch = (update: Partial<Translation>) =>
    setValues((current) => ({
      ...current,
      translations: current.translations.map((entry) =>
        entry.locale === activeLocale ? { ...entry, ...update } : entry,
      ),
    }));

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveContentBlockAction({
        id: values.id,
        isVisible: values.isVisible,
        position: values.position,
        productSlug: values.productSlug,
        translations: values.translations,
      });
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.code === 'forbidden' ? 'Droits insuffisants.' : 'Enregistrement impossible.');
      }
    });
  };

  return (
    <section className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--surface-line)] px-5 py-3">
        <h2 className="lockup text-[var(--surface-muted)]">{values.label}</h2>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={values.isVisible}
            onChange={(event) => {
              setValues((current) => ({ ...current, isVisible: event.target.checked }));
              setSaved(false);
            }}
            className="size-4 appearance-none rounded-[4px] border border-[var(--surface-field-line)] checked:border-[var(--surface-fg)] checked:bg-[var(--surface-fg)]"
          />
          Visible sur le site
        </label>
      </header>

      <div className="p-5">
        {error ? (
          <p role="alert" className="mb-4 flex items-start gap-3 rounded-md border border-[var(--color-critical)] px-4 py-3 text-sm">
            <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-critical)]" />
            {error}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="mb-4 border border-[var(--color-positive)] px-4 py-3 text-sm">
            Bloc enregistré.
          </p>
        ) : null}

        <div role="tablist" aria-label="Langue" className="mb-5 flex gap-2">
          {LOCALES.map((locale) => (
            <button
              key={locale.code}
              type="button"
              role="tab"
              aria-selected={activeLocale === locale.code}
              onClick={() => setActiveLocale(locale.code)}
              className={cn(
                'min-h-9 border px-3 text-xs uppercase tracking-[0.12em] transition-colors',
                activeLocale === locale.code
                  ? 'border-[var(--surface-fg)] bg-[var(--surface-fg)] text-[var(--surface-bg)]'
                  : 'border-[var(--surface-line)] hover:border-[var(--surface-fg)]',
              )}
            >
              {locale.label}
            </button>
          ))}
        </div>

        <div className="grid gap-5">
          <TextField
            id={`eyebrow-${values.id}-${activeLocale}`}
            label="Sur-titre"
            value={translation.eyebrow}
            onChange={(event) => patch({ eyebrow: event.target.value })}
            hint="Petite ligne en capitales espacées."
          />
          <TextField
            id={`heading-${values.id}-${activeLocale}`}
            label="Titre"
            value={translation.heading}
            onChange={(event) => patch({ heading: event.target.value })}
          />
          <TextAreaField
            id={`body-${values.id}-${activeLocale}`}
            label="Texte"
            value={translation.body}
            onChange={(event) => patch({ body: event.target.value })}
            rows={3}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id={`ctaLabel-${values.id}-${activeLocale}`}
              label="Libellé du bouton"
              value={translation.ctaLabel}
              onChange={(event) => patch({ ctaLabel: event.target.value })}
            />
            <TextField
              id={`ctaHref-${values.id}-${activeLocale}`}
              label="Lien du bouton"
              value={translation.ctaHref}
              onChange={(event) => patch({ ctaHref: event.target.value })}
              placeholder="/fr/soins"
            />
          </div>

          {values.kind === 'hero' ? (
            <SelectField
              id={`product-${values.id}`}
              label="Produit mis en avant"
              value={values.productSlug ?? ''}
              onChange={(event) => {
                setValues((current) => ({ ...current, productSlug: event.target.value || null }));
                setSaved(false);
              }}
              hint="À défaut, le premier produit signature est utilisé."
            >
              <option value="">—</option>
              {productOptions.map((product) => (
                <option key={product.slug} value={product.slug}>
                  {product.name}
                </option>
              ))}
            </SelectField>
          ) : null}
        </div>

        <Button type="button" size="sm" loading={pending} onClick={save} className="mt-6">
          Enregistrer ce bloc
        </Button>
      </div>
    </section>
  );
}
