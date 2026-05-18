"use client"

import { Github, Linkedin, Twitter, Mail } from "lucide-react";

/**
 * Footer navigation links.
 * - Links that correspond to real on-page sections use a hash (#section-id)
 *   and the matching section must have id="<section-id>" in the DOM.
 * - Links that are not yet implemented use href="#" with aria-disabled so they
 *   are accessible but visually indicate they are coming soon, rather than
 *   silently doing nothing when the anchor target is missing.
 */
export const Footer = () => {
    const currentYear = new Date().getFullYear();

    const footerLinks = [
        {
            title: "Product",
            links: [
                // "features-section" id exists in Features.tsx
                { label: "Features", href: "#features-section", disabled: false },
                { label: "Pricing", href: "#", disabled: true },
                { label: "Security", href: "#", disabled: true },
                { label: "Roadmap", href: "#", disabled: true },
            ],
        },
        {
            title: "Company",
            links: [
                { label: "About", href: "#", disabled: true },
                { label: "Blog", href: "#", disabled: true },
                { label: "Careers", href: "#", disabled: true },
                { label: "Contact", href: "#", disabled: true },
            ],
        },
        {
            title: "Legal",
            links: [
                { label: "Privacy", href: "#", disabled: true },
                { label: "Terms", href: "#", disabled: true },
                { label: "Cookies", href: "#", disabled: true },
                { label: "Compliance", href: "#", disabled: true },
            ],
        },
    ];

    const socialLinks = [
        { icon: Github, href: "https://github.com", label: "GitHub" },
        { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
        { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
        { icon: Mail, href: "mailto:hello@kachow.dev", label: "Email" },
    ];

    return (
        <footer className="relative bg-background border-t border-border mt-20 py-16 px-6 overflow-hidden">
            <div className="max-w-7xl mx-auto relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    {/* Brand Column */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-semibold text-foreground m-0">
                                KA-CHOW
                            </h2>
                        </div>
                        <p className="text-muted-foreground max-w-sm leading-relaxed">
                            The autonomous engineering brain that understands your entire codebase architecture like a Staff Engineer.
                        </p>
                        <div className="flex gap-4">
                            {socialLinks.map((social) => {
                                const Icon = social.icon;
                                return (
                                    <a
                                        key={social.label}
                                        href={social.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group relative w-10 h-10 rounded-lg flex items-center justify-center border border-border bg-card hover:border-primary/50 transition-all duration-300"
                                        aria-label={social.label}
                                    >
                                        <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </a>
                                );
                            })}
                        </div>
                    </div>

                    {/* Link columns */}
                    {footerLinks.map((section) => (
                        <div key={section.title}>
                            <h4 className="font-semibold mb-4 text-foreground">
                                {section.title}
                            </h4>
                            <ul className="space-y-3">
                                {section.links.map((link) => (
                                    <li key={link.label}>
                                        {link.disabled ? (
                                            <span
                                                className="text-sm text-muted-foreground/50 cursor-default select-none inline-flex items-center gap-1"
                                                title="Coming soon"
                                                aria-disabled="true"
                                            >
                                                {link.label}
                                                <span className="font-mono text-[9px] uppercase tracking-widest opacity-60 border border-muted-foreground/20 px-1 rounded">
                                                    soon
                                                </span>
                                            </span>
                                        ) : (
                                            <a
                                                href={link.href}
                                                className="text-sm text-muted-foreground hover:text-primary hover:translate-x-1 inline-block transition-all duration-300"
                                            >
                                                {link.label}
                                            </a>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom bar */}
                <div className="pt-8 border-t border-border">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <p className="text-sm text-muted-foreground">
                            Copyright {currentYear} KA-CHOW. All rights reserved.
                        </p>

                        <div className="flex gap-6">
                            <span className="text-sm text-muted-foreground/50 cursor-default" title="Coming soon">Privacy Policy</span>
                            <span className="text-sm text-muted-foreground/50 cursor-default" title="Coming soon">Terms of Service</span>
                            <span className="text-sm text-muted-foreground/50 cursor-default" title="Coming soon">Status</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Background glow */}
            <div
                className="absolute top-0 left-1/4 w-64 h-64 rounded-full blur-[100px] pointer-events-none"
                style={{ background: "rgba(88,166,255,0.05)" }}
            />
            <div
                className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-[100px] pointer-events-none"
                style={{ background: "rgba(88,166,255,0.05)" }}
            />
        </footer>
    );
};
