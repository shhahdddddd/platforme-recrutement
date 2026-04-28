/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{html,ts}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#6366f1',
                'primary-hover': '#4f46e5',
                'bg-main': '#0f172a',
                'bg-card': '#1e293b',
                'text-main': '#f8fafc',
                'text-muted': '#94a3b8',
            }
        },
    },
    plugins: [],
}
