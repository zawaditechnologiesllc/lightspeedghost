export interface SchemaBlock {
  "@context": string;
  "@type": string | string[];
  [key: string]: unknown;
}

export interface PageSchemas {
  schemas: SchemaBlock[];
}

export function buildOrganizationSchema(): SchemaBlock {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LightspeedGhost",
    url: "https://lightspeedghost.com",
    logo: "https://lightspeedghost.com/icon-512.png",
    description: "AI-powered academic writing assistance, statistical data analysis, financial statement analysis, STEM problem solving, and AI text refinement platform.",
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Support",
      url: "https://lightspeedghost.com/contact",
    },
  };
}

export function buildSoftwareApplicationSchema(
  name: string,
  description: string,
  price: string,
  priceCurrency: string,
  category: string
): SchemaBlock {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    description,
    applicationCategory: category,
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price,
      priceCurrency,
    },
    url: "https://lightspeedghost.com",
    provider: {
      "@type": "Organization",
      name: "LightspeedGhost",
    },
  };
}

export function buildServiceSchema(
  name: string,
  description: string,
  serviceType: string,
  price?: string
): SchemaBlock {
  const schema: SchemaBlock = {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    serviceType,
    provider: {
      "@type": "Organization",
      name: "LightspeedGhost",
      url: "https://lightspeedghost.com",
    },
    areaServed: "Worldwide",
  };
  if (price) {
    schema.offers = {
      "@type": "Offer",
      price,
      priceCurrency: "USD",
    };
  }
  return schema;
}

export function buildFAQSchema(faqs: Array<{ question: string; answer: string }>): SchemaBlock {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function buildBreadcrumbSchema(items: Array<{ name: string; url: string }>): SchemaBlock {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildArticleSchema(
  title: string,
  description: string,
  url: string,
  datePublished: string,
  dateModified: string
): SchemaBlock {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url,
    datePublished,
    dateModified,
    author: {
      "@type": "Organization",
      name: "LightspeedGhost",
      url: "https://lightspeedghost.com",
    },
    publisher: {
      "@type": "Organization",
      name: "LightspeedGhost",
      logo: {
        "@type": "ImageObject",
        url: "https://lightspeedghost.com/icon-512.png",
      },
    },
  };
}

export function buildHowToSchema(
  name: string,
  description: string,
  steps: Array<{ name: string; text: string }>
): SchemaBlock {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    step: steps.map((s, idx) => ({
      "@type": "HowToStep",
      position: idx + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

export function buildPageSchemas(opts: {
  pageType: string;
  title: string;
  description: string;
  slug: string;
  faqs: Array<{ question: string; answer: string }>;
  datePublished?: string;
  steps?: Array<{ name: string; text: string }>;
}): SchemaBlock[] {
  const baseUrl = "https://lightspeedghost.com";
  const url = `${baseUrl}/seo/${opts.slug}`;
  const today = opts.datePublished ?? new Date().toISOString().split("T")[0];

  const schemas: SchemaBlock[] = [];

  schemas.push(
    buildBreadcrumbSchema([
      { name: "Home", url: baseUrl },
      { name: opts.title, url },
    ])
  );

  if (opts.faqs.length > 0) {
    schemas.push(buildFAQSchema(opts.faqs));
  }

  const serviceTypes: Record<string, boolean> = {
    service: true,
    "software-specific": true,
    "method-specific": true,
    "financial-analysis": true,
    "data-analysis": true,
  };

  if (serviceTypes[opts.pageType]) {
    schemas.push(
      buildServiceSchema(opts.title, opts.description, opts.pageType, "9.99")
    );
  } else if (opts.pageType === "tool") {
    schemas.push(
      buildSoftwareApplicationSchema(
        opts.title,
        opts.description,
        "4.99",
        "USD",
        "EducationalApplication"
      )
    );
  } else if (opts.pageType === "how-to" && opts.steps) {
    schemas.push(buildHowToSchema(opts.title, opts.description, opts.steps));
  } else {
    schemas.push(buildArticleSchema(opts.title, opts.description, url, today, today));
  }

  schemas.push(buildOrganizationSchema());

  return schemas;
}
