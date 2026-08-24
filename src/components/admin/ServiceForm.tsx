'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { IconAlert, IconPlus, IconTrash } from '@/components/ui/icons';
import { saveServiceAction } from '@/modules/admin/actions/services';
import { setAvailabilityExceptionAction, removeAvailabilityExceptionAction } from '@/modules/admin/actions/reservations';
import { cn } from '@/lib/cn';

const LOCALES = [
  { code: 'FR', label: 'Français' },
  { code: 'EN', label: 'English' },
  { code: 'AR', label: 'العربية' },
] as const;

type LocaleCode = (typeof LOCALES)[number]['code'];

const WEEKDAYS = [
  { value: 0, label: 'Dimanche' },
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
];

export type ServiceFormValues = {
  id?: string;
  slug: string;
  state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  durationMin: string;
  capacity: string;
  price: string;
  bufferMin: string;
  leadTimeHours: string;
  horizonDays: string;
  locationId: string;
  position: string;
  translations: {
    locale: LocaleCode;
    name: string;
    tagline: string;
    description: string;
    preparation: string;
  }[];
  rules: { key: string; weekday: string; start: string; end: string; every: string }[];
  exceptions: { id: string; date: string; isOpen: boolean; reason: string | null }[];
};

const toMinutes = (time: string): number => {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
};

const toTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * A service is an availability rule set, not a calendar.
 *
 * Opening hours are entered once per weekday and the slots are generated from
 * them; a closure is a dated exception on top. That is the only model that
 * scales past a week — asking an administrator to tick individual slots for a
 * 45-day horizon would be 400 checkboxes.
 */
export function ServiceForm({
  initial,
  locations,
  redirectTo,
}: {
  initial: ServiceFormValues;
  locations: { id: string; name: string }[];
  redirectTo: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);
  const [activeLocale, setActiveLocale] = useState<LocaleCode>('FR');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [closureDate, setClosureDate] = useState('');
  const [closureReason, setClosureReason] = useState('');

  const translation =
    values.translations.find((entry) => entry.locale === activeLocale) ?? values.translations[0]!;

  const patch = (update: Partial<(typeof values.translations)[number]>) =>
    setValues((current) => ({
      ...current,
      translations: current.translations.map((entry) =>
        entry.locale === activeLocale ? { ...entry, ...update } : entry,
      ),
    }));

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await saveServiceAction({
        id: values.id ?? '',
        slug: values.slug,
        state: values.state,
        durationMin: values.durationMin,
        capacity: values.capacity,
        price: values.price,
        bufferMin: values.bufferMin,
        leadTimeHours: values.leadTimeHours,
        horizonDays: values.horizonDays,
        locationId: values.locationId,
        position: values.position,
        translations: values.translations.filter((entry) => entry.name.trim() !== ''),
        rules: values.rules.map((rule) => ({
          weekday: Number(rule.weekday),
          startMin: toMinutes(rule.start),
          endMin: toMinutes(rule.end),
          slotEveryMin: Number(rule.every),
        })),
      });

      if (result.ok) {
        setSaved(true);
        if (!values.id) router.replace(`${redirectTo}/${result.data.id}`);
        else router.refresh();
        return;
      }
      setError(result.message);
    });
  };

  const addClosure = () => {
    if (!closureDate || !values.id) return;
    startTransition(async () => {
      const result = await setAvailabilityExceptionAction({
        serviceId: values.id,
        date: closureDate,
        isOpen: false,
        reason: closureReason || null,
      });
      if (result.ok) {
        setValues((current) => ({
          ...current,
          exceptions: [
            ...current.exceptions.filter((entry) => entry.date !== closureDate),
            { id: closureDate, date: closureDate, isOpen: false, reason: closureReason || null },
          ].sort((a, b) => a.date.localeCompare(b.date)),
        }));
        setClosureDate('');
        setClosureReason('');
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  };

  const removeClosure = (date: string) => {
    if (!values.id) return;
    startTransition(async () => {
      const result = await removeAvailabilityExceptionAction({ serviceId: values.id, date });
      if (result.ok) {
        setValues((current) => ({
          ...current,
          exceptions: current.exceptions.filter((entry) => entry.date !== date),
        }));
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={submit} noValidate className="flex flex-col gap-8">
        {error ? (
          <p role="alert" className="flex items-start gap-3 border border-[var(--color-critical)] bg-[var(--surface-raised)] px-4 py-3 text-sm">
            <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-critical)]" />
            {error}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="border border-[var(--color-positive)] bg-[var(--surface-raised)] px-4 py-3 text-sm">
            Service enregistré.
          </p>
        ) : null}

        <Section title="Le service">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <TextField
              id="slug"
              label="Slug (URL)"
              value={values.slug}
              onChange={(event) => setValues({ ...values, slug: event.target.value })}
              required
            />
            <SelectField
              id="state"
              label="État"
              value={values.state}
              onChange={(event) =>
                setValues({ ...values, state: event.target.value as ServiceFormValues['state'] })
              }
            >
              <option value="DRAFT">Brouillon</option>
              <option value="PUBLISHED">Publié</option>
              <option value="ARCHIVED">Archivé</option>
            </SelectField>
            <SelectField
              id="locationId"
              label="Lieu"
              value={values.locationId}
              onChange={(event) => setValues({ ...values, locationId: event.target.value })}
            >
              <option value="">—</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </SelectField>
            <TextField
              id="durationMin"
              label="Durée (minutes)"
              value={values.durationMin}
              onChange={(event) => setValues({ ...values, durationMin: event.target.value })}
              inputMode="numeric"
              required
            />
            <TextField
              id="capacity"
              label="Places par créneau"
              value={values.capacity}
              onChange={(event) => setValues({ ...values, capacity: event.target.value })}
              inputMode="numeric"
              hint="1 pour un rendez-vous individuel."
              required
            />
            <TextField
              id="price"
              label="Prix (DT)"
              value={values.price}
              onChange={(event) => setValues({ ...values, price: event.target.value })}
              inputMode="decimal"
              optional
              optionalLabel="facultatif"
            />
            <TextField
              id="bufferMin"
              label="Battement (minutes)"
              value={values.bufferMin}
              onChange={(event) => setValues({ ...values, bufferMin: event.target.value })}
              inputMode="numeric"
              hint="Temps de remise en état entre deux rendez-vous."
            />
            <TextField
              id="leadTimeHours"
              label="Délai minimum (heures)"
              value={values.leadTimeHours}
              onChange={(event) => setValues({ ...values, leadTimeHours: event.target.value })}
              inputMode="numeric"
              hint="Empêche une réservation pour dans dix minutes."
            />
            <TextField
              id="horizonDays"
              label="Horizon (jours)"
              value={values.horizonDays}
              onChange={(event) => setValues({ ...values, horizonDays: event.target.value })}
              inputMode="numeric"
              hint="Jusqu’où les clientes peuvent réserver."
            />
          </div>
        </Section>

        <Section title="Contenu">
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
              id={`name-${activeLocale}`}
              label="Nom"
              value={translation.name}
              onChange={(event) => patch({ name: event.target.value })}
              required={activeLocale === 'FR'}
            />
            <TextField
              id={`tagline-${activeLocale}`}
              label="Accroche"
              value={translation.tagline}
              onChange={(event) => patch({ tagline: event.target.value })}
              optional
              optionalLabel="facultatif"
            />
            <TextAreaField
              id={`description-${activeLocale}`}
              label="Description"
              value={translation.description}
              onChange={(event) => patch({ description: event.target.value })}
              rows={4}
              optional
              optionalLabel="facultatif"
            />
            <TextAreaField
              id={`preparation-${activeLocale}`}
              label="Avant la venue"
              value={translation.preparation}
              onChange={(event) => patch({ preparation: event.target.value })}
              rows={3}
              optional
              optionalLabel="facultatif"
            />
          </div>
        </Section>

        <Section
          title="Horaires habituels"
          description="Une ligne par plage. Les créneaux réservables sont générés à partir de ces règles ; les rendez-vous déjà pris ne bougent pas."
        >
          <ul className="flex flex-col gap-3">
            {values.rules.map((rule, index) => (
              <li key={rule.key} className="flex flex-wrap items-end gap-3 rounded-md border border-[var(--surface-line)] p-3">
                <SelectField
                  id={`weekday-${rule.key}`}
                  label="Jour"
                  value={rule.weekday}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      rules: current.rules.map((entry, i) =>
                        i === index ? { ...entry, weekday: event.target.value } : entry,
                      ),
                    }))
                  }
                >
                  {WEEKDAYS.map((day) => (
                    <option key={day.value} value={String(day.value)}>
                      {day.label}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  id={`start-${rule.key}`}
                  label="De"
                  type="time"
                  value={rule.start}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      rules: current.rules.map((entry, i) =>
                        i === index ? { ...entry, start: event.target.value } : entry,
                      ),
                    }))
                  }
                />
                <TextField
                  id={`end-${rule.key}`}
                  label="À"
                  type="time"
                  value={rule.end}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      rules: current.rules.map((entry, i) =>
                        i === index ? { ...entry, end: event.target.value } : entry,
                      ),
                    }))
                  }
                />
                <TextField
                  id={`every-${rule.key}`}
                  label="Toutes les (min)"
                  value={rule.every}
                  inputMode="numeric"
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      rules: current.rules.map((entry, i) =>
                        i === index ? { ...entry, every: event.target.value } : entry,
                      ),
                    }))
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setValues((current) => ({
                      ...current,
                      rules: current.rules.filter((_, i) => i !== index),
                    }))
                  }
                  aria-label="Retirer cette plage"
                  className="mb-1 inline-flex min-h-11 items-center gap-2 px-2 text-xs text-[var(--surface-muted)] hover:text-[var(--color-critical)]"
                >
                  <IconTrash width={14} height={14} />
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() =>
              setValues((current) => ({
                ...current,
                rules: [
                  ...current.rules,
                  {
                    key: `rule-${current.rules.length}-${Date.now()}`,
                    weekday: '2',
                    start: '09:00',
                    end: '17:00',
                    every: '60',
                  },
                ],
              }))
            }
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--surface-line)] px-4 text-sm font-semibold hover:border-[var(--surface-fg)]"
          >
            <IconPlus width={14} height={14} />
            Ajouter une plage
          </button>
        </Section>

        <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-[var(--surface-line)] bg-[var(--surface-raised)] px-4 py-4 sm:-mx-8 sm:px-8">
          <Button type="submit" size="lg" loading={pending}>
            {values.id ? 'Enregistrer' : 'Créer le service'}
          </Button>
        </div>
      </form>

      {values.id ? (
        <Section
          title="Fermetures exceptionnelles"
          description="Un jour fermé disparaît du calendrier. Les rendez-vous déjà pris ce jour-là ne sont pas annulés automatiquement : prévenez les clientes et annulez-les depuis la liste des réservations."
        >
          <div className="flex flex-wrap items-end gap-3">
            <TextField
              id="closure-date"
              label="Date"
              type="date"
              value={closureDate}
              onChange={(event) => setClosureDate(event.target.value)}
            />
            <TextField
              id="closure-reason"
              label="Motif"
              value={closureReason}
              onChange={(event) => setClosureReason(event.target.value)}
              optional
              optionalLabel="facultatif"
            />
            <Button type="button" intent="secondary" size="sm" loading={pending} onClick={addClosure} className="mb-1">
              Fermer ce jour
            </Button>
          </div>

          {values.exceptions.length > 0 ? (
            <ul className="mt-5 flex flex-col gap-2">
              {values.exceptions.map((exception) => (
                <li
                  key={exception.date}
                  className="flex items-center gap-4 rounded-md border border-[var(--surface-line)] px-4 py-2 text-sm"
                >
                  <span className="tabular-nums">{exception.date}</span>
                  <span className="text-[var(--surface-muted)]">
                    {exception.isOpen ? 'Ouverture exceptionnelle' : 'Fermé'}
                    {exception.reason ? ` — ${exception.reason}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeClosure(exception.date)}
                    className="ms-auto min-h-10 text-xs uppercase tracking-[0.12em] underline underline-offset-4"
                  >
                    Rétablir
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-[var(--surface-muted)]">Aucune fermeture programmée.</p>
          )}
        </Section>
      ) : null}
    </div>
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
        {description ? <p className="mt-2 text-xs text-[var(--surface-muted)]">{description}</p> : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export { toTime };
