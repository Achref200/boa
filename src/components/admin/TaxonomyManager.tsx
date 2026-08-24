'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ConfirmButton } from './ConfirmButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { IconAlert, IconPlus } from '@/components/ui/icons';
import { archiveTaxonomyAction, saveTaxonomyAction } from '@/modules/admin/actions/taxonomy';
import { PUBLISH_STATE_FR } from '@/lib/labels';
import { cn } from '@/lib/cn';

const LOCALES = [
  { code: 'FR', label: 'Français' },
  { code: 'EN', label: 'English' },
  { code: 'AR', label: 'العربية' },
] as const;

type LocaleCode = (typeof LOCALES)[number]['code'];

export type TaxonomyItem = {
  id: string;
  slug: string;
  position: number;
  state: string;
  parentId: string | null;
  usageCount: number;
  translations: { locale: LocaleCode; name: string; intro: string | null }[];
};

type Draft = {
  id?: string;
  slug: string;
  position: string;
  state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  parentId: string;
  translations: { locale: LocaleCode; name: string; intro: string }[];
};

const blank = (): Draft => ({
  slug: '',
  position: '0',
  state: 'DRAFT',
  parentId: '',
  translations: LOCALES.map((locale) => ({ locale: locale.code, name: '', intro: '' })),
});

/**
 * Categories, concerns and collections share one editor.
 *
 * They are edited in place in the list rather than on their own page: these
 * records are three fields and a name in three languages, and a round trip to a
 * detail page for that is friction. The usage count is shown next to each entry
 * so an administrator can see what archiving would take off the shelf.
 */
export function TaxonomyManager({
  kind,
  items,
  labels,
  showIntro = true,
  showParent = false,
}: {
  kind: 'categories' | 'needs' | 'collections';
  items: TaxonomyItem[];
  labels: { singular: string; usage: string; empty: string };
  showIntro?: boolean;
  showParent?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [activeLocale, setActiveLocale] = useState<LocaleCode>('FR');
  const [error, setError] = useState<string | null>(null);

  const startEdit = (item: TaxonomyItem) =>
    setDraft({
      id: item.id,
      slug: item.slug,
      position: String(item.position),
      state: item.state as Draft['state'],
      parentId: item.parentId ?? '',
      translations: LOCALES.map((locale) => {
        const existing = item.translations.find((entry) => entry.locale === locale.code);
        return {
          locale: locale.code,
          name: existing?.name ?? '',
          intro: existing?.intro ?? '',
        };
      }),
    });

  const patch = (update: Partial<{ name: string; intro: string }>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            translations: current.translations.map((entry) =>
              entry.locale === activeLocale ? { ...entry, ...update } : entry,
            ),
          }
        : current,
    );

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setError(null);

    startTransition(async () => {
      const result = await saveTaxonomyAction({
        kind,
        id: draft.id ?? '',
        slug: draft.slug,
        position: draft.position,
        state: draft.state,
        parentId: showParent ? draft.parentId : '',
        translations: draft.translations.filter((entry) => entry.name.trim() !== ''),
      });

      if (result.ok) {
        setDraft(null);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  };

  const archive = (id: string) => {
    startTransition(async () => {
      const result = await archiveTaxonomyAction({ kind, id });
      if (result.ok) router.refresh();
      else setError(result.message);
    });
  };

  const translation =
    draft?.translations.find((entry) => entry.locale === activeLocale) ?? draft?.translations[0];

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="flex items-start gap-3 border border-[var(--color-critical)] bg-[var(--surface-raised)] px-4 py-3 text-sm">
          <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-critical)]" />
          {error}
        </p>
      ) : null}

      {items.length === 0 && !draft ? (
        <p className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] px-4 py-10 text-center text-sm text-[var(--surface-muted)]">
          {labels.empty}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const name = item.translations.find((entry) => entry.locale === 'FR')?.name ?? item.slug;
          const parent = items.find((candidate) => candidate.id === item.parentId);
          const parentName = parent?.translations.find((entry) => entry.locale === 'FR')?.name;

          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] px-5 py-4"
            >
              <div className="min-w-0">
                <p className="text-sm">
                  {parentName ? (
                    <span className="text-[var(--surface-muted)]">{parentName} › </span>
                  ) : null}
                  {name}
                </p>
                <p className="text-xs text-[var(--surface-muted)]">
                  /{item.slug} · {labels.usage.replace('{count}', String(item.usageCount))}
                </p>
              </div>

              <StatusBadge
                tone={item.state === 'PUBLISHED' ? 'positive' : item.state === 'DRAFT' ? 'caution' : 'neutral'}
              >
                {PUBLISH_STATE_FR[item.state] ?? item.state}
              </StatusBadge>

              <div className="ms-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className="min-h-10 text-xs uppercase tracking-[0.12em] underline underline-offset-4"
                >
                  Modifier
                </button>
                {item.state !== 'ARCHIVED' ? (
                  <ConfirmButton
                    label="Archiver"
                    confirmTitle={`Archiver « ${name} » ?`}
                    confirmBody={`${labels.usage.replace('{count}', String(item.usageCount))} — l’entrée disparaît du site mais rien n’est supprimé, et vous pouvez la republier à tout moment.`}
                    confirmLabel="Archiver"
                    onConfirm={() => archive(item.id)}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {draft && translation ? (
        <form
          onSubmit={save}
          noValidate
          className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] p-5"
        >
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
              id="taxonomy-name"
              label="Nom"
              value={translation.name}
              onChange={(event) => patch({ name: event.target.value })}
              required={activeLocale === 'FR'}
            />
            <TextField
              id="taxonomy-slug"
              label="Slug"
              value={draft.slug}
              onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
              required
            />
            {showParent ? (
              <SelectField
                id="taxonomy-parent"
                label="Catégorie parente"
                value={draft.parentId}
                onChange={(event) => setDraft({ ...draft, parentId: event.target.value })}
              >
                <option value="">— (racine)</option>
                {items
                  .filter((item) => item.id !== draft.id && !item.parentId)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.translations.find((entry) => entry.locale === 'FR')?.name ?? item.slug}
                    </option>
                  ))}
              </SelectField>
            ) : null}
            <SelectField
              id="taxonomy-state"
              label="État"
              value={draft.state}
              onChange={(event) => setDraft({ ...draft, state: event.target.value as Draft['state'] })}
            >
              <option value="DRAFT">Brouillon</option>
              <option value="PUBLISHED">Publié</option>
              <option value="ARCHIVED">Archivé</option>
            </SelectField>
            <TextField
              id="taxonomy-position"
              label="Ordre d’affichage"
              value={draft.position}
              onChange={(event) => setDraft({ ...draft, position: event.target.value })}
              inputMode="numeric"
            />
            {showIntro ? (
              <TextAreaField
                id="taxonomy-intro"
                label="Texte d’introduction"
                value={translation.intro}
                onChange={(event) => patch({ intro: event.target.value })}
                optional
                optionalLabel="facultatif"
                className="sm:col-span-2"
              />
            ) : null}
          </div>

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
          {labels.singular}
        </button>
      )}
    </div>
  );
}
