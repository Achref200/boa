'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ConfirmButton } from './ConfirmButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { IconAlert, IconPlus, IconTrash } from '@/components/ui/icons';
import { archiveRitualAction, saveRitualAction } from '@/modules/admin/actions/rituals';
import { PUBLISH_STATE_FR } from '@/lib/labels';
import { cn } from '@/lib/cn';

const LOCALES = [
  { code: 'FR', label: 'Français' },
  { code: 'EN', label: 'English' },
  { code: 'AR', label: 'العربية' },
] as const;

type LocaleCode = (typeof LOCALES)[number]['code'];

export type RitualItem = {
  id: string;
  slug: string;
  state: string;
  position: number;
  translations: { locale: LocaleCode; name: string; intro: string | null }[];
  steps: {
    id: string;
    position: number;
    productId: string | null;
    productName: string | null;
    titles: { locale: LocaleCode; title: string; body: string | null }[];
  }[];
};

type StepDraft = {
  key: string;
  productId: string;
  titles: { locale: LocaleCode; title: string; body: string }[];
};

type Draft = {
  id?: string;
  slug: string;
  state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  position: string;
  translations: { locale: LocaleCode; name: string; intro: string }[];
  steps: StepDraft[];
};

const emptyStep = (index: number): StepDraft => ({
  key: `step-${index}-${Date.now()}`,
  productId: '',
  titles: LOCALES.map((locale) => ({ locale: locale.code, title: '', body: '' })),
});

const blank = (): Draft => ({
  slug: '',
  state: 'DRAFT',
  position: '0',
  translations: LOCALES.map((locale) => ({ locale: locale.code, name: '', intro: '' })),
  steps: [emptyStep(0)],
});

/**
 * The ritual editor is a sequence editor, not a form.
 *
 * The order of steps *is* the content, so it is the thing that has to be easy
 * to change; everything else on this screen is subordinate to that. Each step
 * points at a real product, so a ritual can never recommend something BOA does
 * not sell.
 */
export function RitualManager({
  rituals,
  products,
}: {
  rituals: RitualItem[];
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [activeLocale, setActiveLocale] = useState<LocaleCode>('FR');
  const [error, setError] = useState<string | null>(null);

  const startEdit = (ritual: RitualItem) =>
    setDraft({
      id: ritual.id,
      slug: ritual.slug,
      state: ritual.state as Draft['state'],
      position: String(ritual.position),
      translations: LOCALES.map((locale) => {
        const existing = ritual.translations.find((entry) => entry.locale === locale.code);
        return { locale: locale.code, name: existing?.name ?? '', intro: existing?.intro ?? '' };
      }),
      steps: ritual.steps.map((step, index) => ({
        key: step.id || `step-${index}`,
        productId: step.productId ?? '',
        titles: LOCALES.map((locale) => {
          const existing = step.titles.find((entry) => entry.locale === locale.code);
          return { locale: locale.code, title: existing?.title ?? '', body: existing?.body ?? '' };
        }),
      })),
    });

  const translation =
    draft?.translations.find((entry) => entry.locale === activeLocale) ?? draft?.translations[0];

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setError(null);

    startTransition(async () => {
      const result = await saveRitualAction({
        id: draft.id ?? '',
        slug: draft.slug,
        state: draft.state,
        position: draft.position,
        translations: draft.translations.filter((entry) => entry.name.trim() !== ''),
        steps: draft.steps.map((step) => ({
          productId: step.productId,
          titles: step.titles.filter((title) => title.title.trim() !== ''),
        })),
      });

      if (result.ok) {
        setDraft(null);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    if (!draft) return;
    const target = index + direction;
    if (target < 0 || target >= draft.steps.length) return;
    const steps = [...draft.steps];
    const [moved] = steps.splice(index, 1);
    steps.splice(target, 0, moved!);
    setDraft({ ...draft, steps });
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="flex items-start gap-3 border border-[var(--color-critical)] bg-[var(--surface-raised)] px-4 py-3 text-sm">
          <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-critical)]" />
          {error}
        </p>
      ) : null}

      {rituals.length === 0 && !draft ? (
        <p className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] px-4 py-10 text-center text-sm text-[var(--surface-muted)]">
          Aucun rituel. La section « Rituels » de l’accueil reste masquée tant qu’il n’y en a pas.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {rituals.map((ritual) => {
          const name = ritual.translations.find((entry) => entry.locale === 'FR')?.name ?? ritual.slug;
          return (
            <li key={ritual.id} className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <p className="font-medium">{name}</p>
                <span className="text-xs text-[var(--surface-muted)]">
                  {ritual.steps.length} étape(s) · /{ritual.slug}
                </span>
                <StatusBadge
                  tone={ritual.state === 'PUBLISHED' ? 'positive' : ritual.state === 'DRAFT' ? 'caution' : 'neutral'}
                >
                  {PUBLISH_STATE_FR[ritual.state] ?? ritual.state}
                </StatusBadge>

                <div className="ms-auto flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => startEdit(ritual)}
                    className="min-h-10 text-xs uppercase tracking-[0.12em] underline underline-offset-4"
                  >
                    Modifier
                  </button>
                  {ritual.state !== 'ARCHIVED' ? (
                    <ConfirmButton
                      label="Archiver"
                      confirmTitle={`Archiver « ${name} » ?`}
                      confirmBody="Le rituel disparaît du site. Les produits qu’il contient ne sont pas touchés."
                      confirmLabel="Archiver"
                      onConfirm={() =>
                        startTransition(async () => {
                          const result = await archiveRitualAction({ id: ritual.id });
                          if (result.ok) router.refresh();
                          else setError(result.message);
                        })
                      }
                    />
                  ) : null}
                </div>
              </div>

              <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--surface-muted)]">
                {ritual.steps.map((step, index) => (
                  <li key={step.id}>
                    {String(index + 1).padStart(2, '0')}{' '}
                    {step.titles.find((title) => title.locale === 'FR')?.title ?? '—'}
                    {step.productName ? ` · ${step.productName}` : ''}
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ul>

      {draft && translation ? (
        <form onSubmit={save} noValidate className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] p-5">
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

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="ritual-name"
              label="Nom du rituel"
              value={translation.name}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  translations: draft.translations.map((entry) =>
                    entry.locale === activeLocale ? { ...entry, name: event.target.value } : entry,
                  ),
                })
              }
              required={activeLocale === 'FR'}
            />
            <TextField
              id="ritual-slug"
              label="Slug"
              value={draft.slug}
              onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
              required
            />
            <SelectField
              id="ritual-state"
              label="État"
              value={draft.state}
              onChange={(event) => setDraft({ ...draft, state: event.target.value as Draft['state'] })}
            >
              <option value="DRAFT">Brouillon</option>
              <option value="PUBLISHED">Publié</option>
              <option value="ARCHIVED">Archivé</option>
            </SelectField>
            <TextField
              id="ritual-position"
              label="Ordre d’affichage"
              value={draft.position}
              onChange={(event) => setDraft({ ...draft, position: event.target.value })}
              inputMode="numeric"
            />
            <TextAreaField
              id="ritual-intro"
              label="Introduction"
              value={translation.intro}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  translations: draft.translations.map((entry) =>
                    entry.locale === activeLocale ? { ...entry, intro: event.target.value } : entry,
                  ),
                })
              }
              optional
              optionalLabel="facultatif"
              className="sm:col-span-2"
            />
          </div>

          <h3 className="lockup mt-8 mb-3 text-[10px] text-[var(--surface-muted)]">Étapes</h3>
          <ol className="flex flex-col gap-4">
            {draft.steps.map((step, index) => {
              const title = step.titles.find((entry) => entry.locale === activeLocale) ?? step.titles[0]!;
              return (
                <li key={step.key} className="rounded-md border border-[var(--surface-line)] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="font-display text-lg text-[var(--surface-accent)]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label="Monter cette étape"
                      className="min-h-9 rounded-md border border-[var(--surface-line)] px-2 text-xs disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === draft.steps.length - 1}
                      aria-label="Descendre cette étape"
                      className="min-h-9 rounded-md border border-[var(--surface-line)] px-2 text-xs disabled:opacity-40"
                    >
                      ↓
                    </button>
                    {draft.steps.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== index) })
                        }
                        className="ms-auto inline-flex min-h-9 items-center gap-2 text-xs text-[var(--surface-muted)] hover:text-[var(--color-critical)]"
                      >
                        <IconTrash width={14} height={14} />
                        Retirer
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      id={`step-title-${step.key}`}
                      label="Titre de l’étape"
                      value={title.title}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          steps: draft.steps.map((entry, i) =>
                            i === index
                              ? {
                                  ...entry,
                                  titles: entry.titles.map((t) =>
                                    t.locale === activeLocale ? { ...t, title: event.target.value } : t,
                                  ),
                                }
                              : entry,
                          ),
                        })
                      }
                    />
                    <SelectField
                      id={`step-product-${step.key}`}
                      label="Produit"
                      value={step.productId}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          steps: draft.steps.map((entry, i) =>
                            i === index ? { ...entry, productId: event.target.value } : entry,
                          ),
                        })
                      }
                    >
                      <option value="">—</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </SelectField>
                    <TextAreaField
                      id={`step-body-${step.key}`}
                      label="Explication"
                      value={title.body}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          steps: draft.steps.map((entry, i) =>
                            i === index
                              ? {
                                  ...entry,
                                  titles: entry.titles.map((t) =>
                                    t.locale === activeLocale ? { ...t, body: event.target.value } : t,
                                  ),
                                }
                              : entry,
                          ),
                        })
                      }
                      optional
                      optionalLabel="facultatif"
                      className="sm:col-span-2"
                      rows={2}
                    />
                  </div>
                </li>
              );
            })}
          </ol>

          <button
            type="button"
            onClick={() => setDraft({ ...draft, steps: [...draft.steps, emptyStep(draft.steps.length)] })}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--surface-line)] px-4 text-sm font-semibold hover:border-[var(--surface-fg)]"
          >
            <IconPlus width={14} height={14} />
            Ajouter une étape
          </button>

          <div className="mt-6 flex gap-3">
            <Button type="submit" size="sm" loading={pending}>
              Enregistrer
            </Button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="min-h-11 px-4 text-xs uppercase tracking-[0.12em] text-[var(--surface-muted)] underline underline-offset-4"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setDraft(blank())}
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-[var(--surface-line)] bg-[var(--surface-raised)] px-4 text-sm font-semibold hover:border-[var(--surface-fg)]"
        >
          <IconPlus width={14} height={14} />
          Nouveau rituel
        </button>
      )}
    </div>
  );
}
