import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Tracer Docs',
  description: 'Документация по библиотеке tracer',
  lang: 'ru-RU',
  ignoreDeadLinks: [/\.\/\.\.\/Test-plan-1/],
  themeConfig: {
    nav: [
      { text: 'Главная', link: '/' },
      { text: 'Guides', link: '/readme' },
      { text: 'API', link: '/api-reference' },
      { text: 'Reports', link: '/reports' }
    ],
    sidebar: [
      {
        text: 'Start',
        items: [
          { text: 'Главная', link: '/' },
          { text: 'Readme', link: '/readme' },
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Context', link: '/context' }
        ]
      },
      {
        text: 'Guides',
        items: [
          { text: 'Tracer Dev Guide', link: '/tracer-dev-guide' },
          { text: 'Tracer AI Guide', link: '/tracer-ai-guide' },
          { text: 'All Docs (Unified)', link: '/all-docs' },
          { text: 'New Doc', link: '/new%20doc' }
        ]
      },
      {
        text: 'API',
        items: [
          { text: 'API Reference', link: '/api-reference' },
          { text: 'Async', link: '/async' },
          { text: 'Slices', link: '/slices' }
        ]
      },
      {
        text: 'Reports',
        items: [
          { text: 'Reports Overview', link: '/reports' },
          { text: 'Reports Guide', link: '/reports-guide' }
        ]
      },
      {
        text: 'Theme',
        items: [{ text: 'Theme API Demo', link: '/theme-api-demo' }]
      }
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/logicspark/vitepress-theme-api' }]
  }
});
