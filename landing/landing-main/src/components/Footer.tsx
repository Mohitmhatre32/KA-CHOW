import { Github, Linkedin, Twitter, Mail } from 'lucide-react';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '#features' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'Security', href: '#security' },
        { label: 'Roadmap', href: '#roadmap' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '#about' },
        { label: 'Blog', href: '#blog' },
        { label: 'Careers', href: '#careers' },
        { label: 'Contact', href: '#contact' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy', href: '#privacy' },
        { label: 'Terms', href: '#terms' },
        { label: 'Cookies', href: '#cookies' },
        { label: 'Compliance', href: '#compliance' },
      ],
    },
  ];

  const socialLinks = [
    { icon: Github, href: '#github', label: 'GitHub' },
    { icon: Twitter, href: '#twitter', label: 'Twitter' },
    { icon: Linkedin, href: '#linkedin', label: 'LinkedIn' },
    { icon: Mail, href: '#email', label: 'Email' },
  ];

  return (
    <footer className="relative bg-[#0d1117] border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          <div className="lg:col-span-1">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">KA-CHOW</h3>
              <p className="text-gray-500 text-sm">
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
                    className="group relative w-10 h-10 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center
                             hover:border-[#3fb950] transition-all duration-300
                             hover:shadow-[0_0_15px_rgba(63,185,80,0.2)]"
                    aria-label={social.label}
                  >
                    <Icon className="w-5 h-5 text-gray-400 group-hover:text-[#3fb950] transition-colors duration-300" />
                  </a>
                );
              })}
            </div>
          </div>

          {footerLinks.map((section) => (
            <div key={section.title}>
              <h4 className="text-white font-semibold mb-4">{section.title}</h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-gray-500 hover:text-[#3fb950] transition-colors duration-300
                               text-sm hover:translate-x-1 inline-block"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-gray-500 text-sm">
              Copyright {currentYear} KA-CHOW. All rights reserved.
            </p>

            <div className="flex gap-6">
              <a
                href="#privacy"
                className="text-gray-500 hover:text-[#3fb950] transition-colors duration-300 text-sm"
              >
                Privacy Policy
              </a>
              <a
                href="#terms"
                className="text-gray-500 hover:text-[#3fb950] transition-colors duration-300 text-sm"
              >
                Terms of Service
              </a>
              <a
                href="#status"
                className="text-gray-500 hover:text-[#3fb950] transition-colors duration-300 text-sm"
              >
                Status
              </a>
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute top-0 left-1/4 w-64 h-64 bg-[#3fb950]/5 rounded-full blur-[100px] pointer-events-none"
      />
      <div
        className="absolute bottom-0 right-1/4 w-64 h-64 bg-[#3fb950]/5 rounded-full blur-[100px] pointer-events-none"
      />
    </footer>
  );
};
