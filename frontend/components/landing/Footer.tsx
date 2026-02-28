"use client"

import { Github, Linkedin, Twitter, Mail } from "lucide-react";

export const Footer = () => {
    const currentYear = new Date().getFullYear();

    const footerLinks = [
        {
            title: "Product",
            links: [
                { label: "Features", href: "#features-section" },
                { label: "Pricing", href: "#pricing" },
                { label: "Security", href: "#security" },
                { label: "Roadmap", href: "#roadmap" },
            ],
        },
        {
            title: "Company",
            links: [
                { label: "About", href: "#about" },
                { label: "Blog", href: "#blog" },
                { label: "Careers", href: "#careers" },
                { label: "Contact", href: "#contact" },
            ],
        },
        {
            title: "Legal",
            links: [
                { label: "Privacy", href: "#privacy" },
                { label: "Terms", href: "#terms" },
                { label: "Cookies", href: "#cookies" },
                { label: "Compliance", href: "#compliance" },
            ],
        },
    ];

    const socialLinks = [
        { icon: Github, href: "#github", label: "GitHub" },
        { icon: Twitter, href: "#twitter", label: "Twitter" },
        { icon: Linkedin, href: "#linkedin", label: "LinkedIn" },
        { icon: Mail, href: "#email", label: "Email" },
    ];

    return (
        <footer className="relative" style={{ background: "var(--background)", borderTop: "1px solid var(--border)" }}>
            <div className="max-w-7xl mx-auto px-6 py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
                    {/* Brand */}
                    <div className="lg:col-span-1">
                        <div className="mb-6">
                            <h3 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
                                DevInsight AI
                            </h3>
                            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                                Engineering intelligence platform
                            </p>
                        </div>

                        <div className="flex gap-4">
                            {socialLinks.map((social) => {
                                const Icon = social.icon;
                                return (
                                    <a
                                        key={social.label}
                                        href={social.href}
                                        className="group relative w-10 h-10 rounded-lg flex items-center justify-center
                             transition-all duration-300"
                                        style={{
                                            background: "var(--card)",
                                            border: "1px solid var(--border)",
                                        }}
                                        aria-label={social.label}
                                    >
                                        <Icon
                                            className="w-5 h-5 transition-colors duration-300"
                                            style={{ color: "var(--muted-foreground)" }}
                                        />
                                    </a>
                                );
                            })}
                        </div>
                    </div>

                    {/* Link columns */}
                    {footerLinks.map((section) => (
                        <div key={section.title}>
                            <h4 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                                {section.title}
                            </h4>
                            <ul className="space-y-3">
                                {section.links.map((link) => (
                                    <li key={link.label}>
                                        <a
                                            href={link.href}
                                            className="text-sm hover:translate-x-1 inline-block transition-all duration-300"
                                            style={{ color: "var(--muted-foreground)" }}
                                        >
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom bar */}
                <div style={{ borderTop: "1px solid var(--border)" }} className="pt-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                            Copyright {currentYear} DevInsight AI. All rights reserved.
                        </p>

                        <div className="flex gap-6">
                            <a href="#privacy" className="text-sm transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                                Privacy Policy
                            </a>
                            <a href="#terms" className="text-sm transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                                Terms of Service
                            </a>
                            <a href="#status" className="text-sm transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                                Status
                            </a>
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
