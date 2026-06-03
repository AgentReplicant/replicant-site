// templates/local-service/components/Contact.tsx
//
// Closer section. Contact info + booking/quote CTAs + optional socials.
// All anchor tags use React.createElement to avoid clipboard angle-bracket
// corruption when patches are pasted into this codebase (workflow rule).

import React from "react";
import type { ContactContent, SocialLinks } from "../types";

type Props = {
  contact: ContactContent;
  socials?: SocialLinks;
};

const PRIMARY_CTA_CLASS =
  "inline-flex items-center justify-center rounded-md bg-[var(--brand)] px-6 py-3 text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90";

const SECONDARY_CTA_CLASS =
  "inline-flex items-center justify-center rounded-md border border-neutral-300 px-6 py-3 text-base font-semibold text-neutral-900 transition-opacity hover:opacity-80";

const SOCIAL_LINK_CLASS =
  "text-sm font-medium text-[var(--brand)] underline-offset-4 transition-opacity hover:opacity-80 hover:underline";

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function ctaLink(href: string, label: string, className: string, key: string) {
  const external = isExternalHref(href);
  return React.createElement(
    "a",
    {
      href,
      className,
      key,
      ...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}),
    },
    label
  );
}

function inlineLink(href: string, label: string, className: string, key: string) {
  return React.createElement(
    "a",
    { href, className, key, target: "_blank", rel: "noopener noreferrer" },
    label
  );
}

export function Contact({ contact, socials }: Props) {
  const ctas: React.ReactNode[] = [];
  if (contact.bookingLink) {
    ctas.push(ctaLink(contact.bookingLink, "Book now", PRIMARY_CTA_CLASS, "cta-book"));
  }
  if (contact.quoteLink) {
    ctas.push(
      ctaLink(
        contact.quoteLink,
        "Request a quote",
        ctas.length === 0 ? PRIMARY_CTA_CLASS : SECONDARY_CTA_CLASS,
        "cta-quote"
      )
    );
  }
  if (contact.phone && ctas.length === 0) {
    ctas.push(
      ctaLink(`tel:${contact.phone}`, `Call ${contact.phone}`, PRIMARY_CTA_CLASS, "cta-call")
    );
  }

  const socialLinks: React.ReactNode[] = [];
  if (socials?.instagram) {
    socialLinks.push(inlineLink(socials.instagram, "Instagram", SOCIAL_LINK_CLASS, "soc-ig"));
  }
  if (socials?.facebook) {
    socialLinks.push(inlineLink(socials.facebook, "Facebook", SOCIAL_LINK_CLASS, "soc-fb"));
  }
  if (socials?.tiktok) {
    socialLinks.push(inlineLink(socials.tiktok, "TikTok", SOCIAL_LINK_CLASS, "soc-tt"));
  }
  if (socials?.googleBusiness) {
    socialLinks.push(
      inlineLink(socials.googleBusiness, "Google Business", SOCIAL_LINK_CLASS, "soc-gb")
    );
  }

  const phoneAnchor = contact.phone
    ? React.createElement(
        "a",
        {
          href: `tel:${contact.phone}`,
          className: "text-neutral-900 underline-offset-4 hover:underline",
        },
        contact.phone
      )
    : null;

  const emailAnchor = contact.email
    ? React.createElement(
        "a",
        {
          href: `mailto:${contact.email}`,
          className: "text-neutral-900 underline-offset-4 hover:underline",
        },
        contact.email
      )
    : null;

  return (
    <section id="contact" className="w-full bg-neutral-50 py-20 sm:py-24">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
          Get in touch
        </h2>
        <p className="mt-3 text-neutral-600">
          Reach out and we&apos;ll get back quickly.
        </p>

        {ctas.length > 0 && (
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {ctas}
          </div>
        )}

        <dl className="mx-auto mt-12 grid max-w-2xl gap-6 text-left sm:grid-cols-2">
          {phoneAnchor && (
            <div>
              <dt className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                Phone
              </dt>
              <dd className="mt-1 text-base">{phoneAnchor}</dd>
            </div>
          )}
          {emailAnchor && (
            <div>
              <dt className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                Email
              </dt>
              <dd className="mt-1 text-base">{emailAnchor}</dd>
            </div>
          )}
          {contact.address && (
            <div>
              <dt className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                Address
              </dt>
              <dd className="mt-1 text-base text-neutral-900">{contact.address}</dd>
            </div>
          )}
          {contact.serviceArea && (
            <div>
              <dt className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                Service area
              </dt>
              <dd className="mt-1 text-base text-neutral-900">{contact.serviceArea}</dd>
            </div>
          )}
          {contact.hours && (
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                Hours
              </dt>
              <dd className="mt-1 text-base text-neutral-900">{contact.hours}</dd>
            </div>
          )}
        </dl>

        {socialLinks.length > 0 && (
          <div className="mt-10 flex flex-wrap justify-center gap-6">
            {socialLinks}
          </div>
        )}
      </div>
    </section>
  );
}