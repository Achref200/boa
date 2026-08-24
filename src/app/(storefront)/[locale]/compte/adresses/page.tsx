import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getCurrentCustomer } from '@/modules/identity/session';
import { getCustomerAddresses } from '@/modules/identity/account';
import { getCheckoutOptions } from '@/modules/orders/checkout-options';
import { AddressBook } from '@/components/store/AddressBook';

export const dynamic = 'force-dynamic';

export default async function AccountAddressesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const customer = await getCurrentCustomer();
  if (!customer) notFound();

  const t = getTranslator(locale);
  const [addresses, options] = await Promise.all([
    getCustomerAddresses(customer.id),
    getCheckoutOptions(locale),
  ]);

  return (
    <div>
      <h2 className="font-display text-[length:var(--text-xl)]">{t('account.addresses')}</h2>

      <div className="mt-8">
        <AddressBook
          addresses={addresses}
          governorates={options.governorates}
          labels={{
            add: t('account.addAddress'),
            edit: t('common.edit'),
            remove: t('common.delete'),
            save: t('common.save'),
            cancel: t('common.cancel'),
            none: t('account.noAddresses'),
            default: t('account.defaultAddress'),
            label: t('contact.subject'),
            firstName: t('checkout.firstName'),
            lastName: t('checkout.lastName'),
            phone: t('checkout.phone'),
            line1: t('checkout.address1'),
            line2: t('checkout.address2'),
            city: t('checkout.city'),
            governorate: t('checkout.governorate'),
            postalCode: t('checkout.postalCode'),
            optional: t('common.optional'),
            generic: t('errors.generic'),
            validation: t('errors.validation'),
            fieldInvalid: t('errors.fieldInvalid'),
          }}
        />
      </div>
    </div>
  );
}
