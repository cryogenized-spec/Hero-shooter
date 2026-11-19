export function getPortraitSVG(archetype, showEarbuds = false) {
                if (archetype === 'young_yael') {
                    return `
                        <svg viewBox="0 0 68 68" width="100%" height="100%">
                            <defs>
                                <linearGradient id="trainBgGrad" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stop-color="#14532d"/>
                                    <stop offset="100%" stop-color="#090d16"/>
                                </linearGradient>
                            </defs>
                            <rect width="68" height="68" fill="url(#trainBgGrad)"/>
                            <!-- High Ponytail -->
                            <path d="M42 15 C54 11, 58 24, 53 35 C49 27, 46 21, 41 19 Z" fill="#090d16"/>
                            <!-- Olive Woodland Hoodie -->
                            <path d="M13 68 C14 52, 22 47, 34 47 C46 47, 54 52, 55 68 Z" fill="#3f6212"/>
                            <path d="M23 48 L34 68 L45 48 Z" fill="#1e293b"/>
                            <rect x="29.5" y="39" width="9" height="9" rx="4" fill="#c88a5d"/>
                            <!-- Youthful Tanned Face -->
                            <path d="M23 24 C23 15, 45 15, 45 24 L44 33.5 C44 39.5, 39 42.5, 34 42.5 C29 42.5, 24 39.5, 24 33.5 Z" fill="#d6986a"/>
                            <!-- Black Hair -->
                            <path d="M20.5 25 C20.5 11, 47.5 11, 47.5 25 C44 18, 38 17, 34 20 C29 17, 23 18, 20.5 25 Z" fill="#111827"/>
                            ${showEarbuds ? `
                                <circle cx="46" cy="28" r="2.1" fill="#f8fafc"/>
                                <path d="M46 30 Q47 42 43 56" stroke="#e2e8f0" stroke-width="1.2" fill="none"/>
                            ` : ''}
                            <!-- Clear Airsoft Eye-Pro Goggles -->
                            <rect x="23" y="24" width="22" height="7" rx="2.5" fill="rgba(186, 230, 253, 0.35)" stroke="#38bdf8" stroke-width="1.2"/>
                            <circle cx="28.5" cy="27.5" r="1.7" fill="#090d16"/>
                            <circle cx="39.5" cy="27.5" r="1.7" fill="#090d16"/>
                            <path d="M30.5 36 Q34 38.2 37.5 36" stroke="#7c2d12" stroke-width="1.6" fill="none" stroke-linecap="round"/>
                            <!-- Pink Airsoft G26 -->
                            <rect x="12" y="52" width="14" height="4.5" rx="1.5" fill="#1e293b"/>
                            <rect x="12" y="56" width="13" height="4.2" rx="1.2" fill="#ec4899"/>
                            <circle cx="26.5" cy="54.2" r="1.5" fill="#f97316"/>
                        </svg>`;
                }
                if (archetype === 'young_g') {
                    return `
                        <svg viewBox="0 0 68 68" width="100%" height="100%">
                            <rect width="68" height="68" fill="#1e293b"/>
                            <path d="M12 68 C13 51, 22 46, 34 46 C46 46, 55 51, 56 68 Z" fill="#334155"/>
                            <rect x="29" y="38" width="10" height="9" rx="4" fill="#c68b59"/>
                            <path d="M22 23 C22 14, 46 14, 46 23 L45 33 C45 40, 39 43, 34 43 C29 43, 23 40, 23 33 Z" fill="#d4a373"/>
                            <!-- Dark Brown Hair (Before Going Silver) -->
                            <path d="M20 24 C20 11, 48 11, 48 24 C46 17, 40 16, 34 16 C28 16, 22 17, 20 24 Z" fill="#451a03"/>
                            <rect x="23" y="24" width="22" height="6.5" rx="2" fill="rgba(186, 230, 253, 0.35)" stroke="#94a3b8" stroke-width="1.2"/>
                            <circle cx="28.5" cy="27.2" r="1.6" fill="#090d16"/>
                            <circle cx="39.5" cy="27.2" r="1.6" fill="#090d16"/>
                            <path d="M30 36 Q34 38 38 36" stroke="#78350f" stroke-width="1.5" fill="none"/>
                        </svg>`;
                }
                if (archetype === 'young_blaze') {
                    return `
                        <svg viewBox="0 0 68 68" width="100%" height="100%">
                            <rect width="68" height="68" fill="#431407"/>
                            <path d="M43 15 C55 12, 58 25, 52 36 C48 27, 45 21, 41 19 Z" fill="#c2410c"/>
                            <path d="M12 68 C13 51, 22 46, 34 46 C46 46, 55 51, 56 68 Z" fill="#18181b"/>
                            <rect x="29" y="38" width="10" height="9" rx="4" fill="#f1c29b"/>
                            <path d="M22 23 C22 14, 46 14, 46 23 L45 33 C45 40, 39 43, 34 43 C29 43, 23 40, 23 33 Z" fill="#fbd3b0"/>
                            <path d="M19 25 C19 10, 49 10, 49 25 C46 18, 39 17, 34 20 C29 17, 22 18, 19 25 Z" fill="#ea580c"/>
                            <rect x="23" y="24" width="22" height="6.5" rx="2" fill="rgba(253, 224, 71, 0.3)" stroke="#f59e0b" stroke-width="1.2"/>
                            <circle cx="28.5" cy="27.2" r="1.6" fill="#15803d"/>
                            <circle cx="39.5" cy="27.2" r="1.6" fill="#15803d"/>
                            <path d="M30 36 Q34 38.5 38 36" stroke="#9f1239" stroke-width="1.6" fill="none"/>
                        </svg>`;
                }
                if (archetype === 'mall') {
                    return `
                        <svg viewBox="0 0 68 68" width="100%" height="100%">
                            <defs>
                                <linearGradient id="mallBgGrad" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stop-color="#3b0764"/>
                                    <stop offset="100%" stop-color="#090d16"/>
                                </linearGradient>
                            </defs>
                            <rect width="68" height="68" fill="url(#mallBgGrad)"/>
                            <path d="M17 24 C15 10, 53 10, 51 24 L54 54 C48 56, 44 51, 43 44 L25 44 C24 51, 20 56, 14 54 Z" fill="#090d16"/>
                            <path d="M13 68 C14 52, 22 47, 34 47 C46 47, 54 52, 55 68 Z" fill="#1e293b"/>
                            <path d="M23 48 L34 68 L45 48 Z" fill="#334155"/>
                            <rect x="29.5" y="39" width="9" height="9" rx="4" fill="#c88a5d"/>
                            <path d="M22.5 24 C22.5 15, 45.5 15, 45.5 24 L44.5 33.5 C44.5 40, 39 43, 34 43 C29 43, 23.5 40, 23.5 33.5 Z" fill="#d6986a"/>
                            <path d="M20 25 C20 11, 48 11, 48 25 C45 18, 38 17, 34 20 C29 17, 23 18, 20 25 Z" fill="#111827"/>
                            <path d="M21 22 C19 32, 19 42, 22 47 C24 41, 24 32, 23 24 Z" fill="#090d16"/>
                            <path d="M47 22 C49 32, 49 42, 46 47 C44 41, 44 32, 45 24 Z" fill="#090d16"/>
                            ${showEarbuds ? `
                                <circle cx="46" cy="28" r="2.1" fill="#f8fafc"/>
                                <path d="M46 30 Q47 42 43 56" stroke="#e2e8f0" stroke-width="1.2" fill="none"/>
                            ` : ''}
                            <path d="M24.5 24.5 L31 25.5" stroke="#090d16" stroke-width="1.6" stroke-linecap="round"/>
                            <path d="M43.5 24.5 L37 25.5" stroke="#090d16" stroke-width="1.6" stroke-linecap="round"/>
                            <circle cx="28" cy="27.5" r="1.8" fill="#090d16"/>
                            <circle cx="40" cy="27.5" r="1.8" fill="#090d16"/>
                            <circle cx="28.5" cy="27" r="0.5" fill="#ffffff"/>
                            <circle cx="40.5" cy="27" r="0.5" fill="#ffffff"/>
                            <path d="M30.5 36.5 Q34 37.8 37.5 36.5" stroke="#7c2d12" stroke-width="1.6" fill="none" stroke-linecap="round"/>
                            <rect x="11" y="51" width="15" height="5" rx="1.5" fill="#1e293b"/>
                            <rect x="11" y="55" width="14" height="4.5" rx="1.2" fill="#ec4899"/>
                            <rect x="12" y="59" width="4.5" height="7" rx="1" fill="#111827" transform="rotate(12 12 59)"/>
                            <rect x="15" y="49" width="4" height="2.2" fill="#090d16"/>
                            <circle cx="17" cy="50" r="0.8" fill="#ef4444"/>
                        </svg>`;
                }
                if (archetype === 'sniper') {
                    return `
                        <svg viewBox="0 0 68 68" width="100%" height="100%">
                            <defs>
                                <linearGradient id="sniperBgGrad" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stop-color="#3f3f46"/>
                                    <stop offset="100%" stop-color="#090d16"/>
                                </linearGradient>
                            </defs>
                            <rect width="68" height="68" fill="url(#sniperBgGrad)"/>
                            <path d="M10 68 C11 50, 20 45, 34 45 C48 45, 57 50, 58 68 Z" fill="#365314"/>
                            <path d="M22 46 L34 68 L46 46 Z" fill="#1e293b"/>
                            <rect x="28" y="38" width="12" height="10" rx="4" fill="#c68b59"/>
                            <path d="M21 23 C21 13, 47 13, 47 23 L46 33 C46 41, 39 44, 34 44 C29 44, 22 41, 22 33 Z" fill="#d4a373"/>
                            <ellipse cx="34" cy="18" rx="22" ry="4.5" fill="#4d7c0f"/>
                            <path d="M20 18 C21 10, 47 10, 48 18 Z" fill="#3f6212"/>
                            ${showEarbuds ? `
                                <rect x="19" y="26" width="3.5" height="9" rx="1.5" fill="#f8fafc"/>
                                <circle cx="21" cy="26.5" r="2.2" fill="#ffffff"/>
                                <rect x="45.5" y="26" width="3.5" height="9" rx="1.5" fill="#f8fafc"/>
                                <circle cx="47" cy="26.5" r="2.2" fill="#ffffff"/>
                            ` : ''}
                            <path d="M22 31 C22 40, 28 44, 34 44 C40 44, 46 40, 46 31 C44 36, 40 38, 34 38 C28 38, 24 36, 22 31 Z" fill="#9ca3af" opacity="0.85"/>
                            <circle cx="28" cy="26.5" r="1.5" fill="#090d16"/>
                            <circle cx="40" cy="26.5" r="1.5" fill="#090d16"/>
                            <line x1="29" y1="36" x2="39" y2="36" stroke="#6b7280" stroke-width="1.6" stroke-linecap="round"/>
                        </svg>`;
                }
                if (archetype === 'female') {
                    return `
                        <svg viewBox="0 0 68 68" width="100%" height="100%">
                            <defs>
                                <linearGradient id="cbdBgGrad" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stop-color="#431407"/>
                                    <stop offset="100%" stop-color="#090d16"/>
                                </linearGradient>
                            </defs>
                            <rect width="68" height="68" fill="url(#cbdBgGrad)"/>
                            <path d="M15 26 C13 10, 55 10, 53 26 L56 54 C50 56, 46 52, 45 45 L23 45 C22 52, 18 56, 12 54 Z" fill="#9a3412"/>
                            <path d="M12 68 C13 51, 22 46, 34 46 C46 46, 55 51, 56 68 Z" fill="#18181b"/>
                            <path d="M21 47 L36 68 L43 68 L27 46 Z" fill="#ea580c"/>
                            <rect x="23" y="51" width="6" height="4" rx="1" fill="#facc15"/>
                            <rect x="29" y="38" width="10" height="10" rx="4" fill="#f1c29b"/>
                            <path d="M22 23 C22 14, 46 14, 46 23 L45 33 C45 40, 39 43, 34 43 C29 43, 23 40, 23 33 Z" fill="#fbd3b0"/>
                            <path d="M19 25 C19 10, 49 10, 49 25 C46 18, 39 17, 34 20 C29 17, 22 18, 19 25 Z" fill="#ea580c"/>
                            <path d="M20 22 C18 32, 18 42, 22 48 C24 41, 24 32, 23 24 Z" fill="#c2410c"/>
                            <path d="M48 22 C50 32, 50 42, 46 48 C44 41, 44 32, 45 24 Z" fill="#c2410c"/>
                            ${showEarbuds ? `
                                <rect x="20" y="27" width="3" height="8" rx="1.5" fill="#f8fafc"/>
                                <circle cx="22" cy="27.5" r="2" fill="#ffffff"/>
                                <rect x="45" y="27" width="3" height="8" rx="1.5" fill="#f8fafc"/>
                                <circle cx="46" cy="27.5" r="2" fill="#ffffff"/>
                            ` : ''}
                            <path d="M24 24 L31 25" stroke="#7c2d12" stroke-width="1.6" stroke-linecap="round"/>
                            <path d="M44 24 L37 25" stroke="#7c2d12" stroke-width="1.6" stroke-linecap="round"/>
                            <circle cx="28" cy="27" r="1.7" fill="#15803d"/>
                            <circle cx="40" cy="27" r="1.7" fill="#15803d"/>
                            <path d="M34 27 L33 32 L35.5 32" stroke="#d99b72" stroke-width="1.3" fill="none"/>
                            <path d="M30 36.5 Q34 38 38 36.5" stroke="#9f1239" stroke-width="1.7" fill="none" stroke-linecap="round"/>
                        </svg>`;
                }
                // G (Suburbs Operative)
                return `
                    <svg viewBox="0 0 68 68" width="100%" height="100%">
                        <defs>
                            <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stop-color="#1e293b"/>
                                <stop offset="100%" stop-color="#090d16"/>
                            </linearGradient>
                        </defs>
                        <rect width="68" height="68" fill="url(#bgGrad)"/>
                        <path d="M10 68 C10 50, 20 45, 34 45 C48 45, 58 50, 58 68 Z" fill="#27272a"/>
                        <path d="M22 46 L38 68 L45 68 L28 45 Z" fill="#3f3f46"/>
                        <rect x="28" y="38" width="12" height="10" rx="4" fill="#c68b59"/>
                        <path d="M21 22 C21 12, 47 12, 47 22 L46 33 C46 41, 39 44, 34 44 C29 44, 22 41, 22 33 Z" fill="#d4a373"/>
                        <path d="M20 23 C20 10, 48 10, 48 23 C48 17, 42 15, 34 15 C26 15, 20 17, 20 23 Z" fill="#cbd5e1"/>
                        ${showEarbuds ? `
                            <rect x="19" y="26" width="3.5" height="9" rx="1.5" fill="#f8fafc"/>
                            <circle cx="21" cy="26.5" r="2.2" fill="#ffffff"/>
                            <rect x="45.5" y="26" width="3.5" height="9" rx="1.5" fill="#f8fafc"/>
                            <circle cx="47" cy="26.5" r="2.2" fill="#ffffff"/>
                        ` : ''}
                        <path d="M22 31 C22 40, 28 44, 34 44 C40 44, 46 40, 46 31 C44 36, 40 38, 34 38 C28 38, 24 36, 22 31 Z" fill="#94a3b8" opacity="0.72"/>
                        <rect x="24" y="23" width="8" height="2" rx="1" fill="#64748b"/>
                        <rect x="36" y="23" width="8" height="2" rx="1" fill="#64748b"/>
                        <circle cx="28" cy="26.5" r="1.5" fill="#090d16"/>
                        <circle cx="40" cy="26.5" r="1.5" fill="#090d16"/>
                        <path d="M34 26 L33 32 L36 32" stroke="#9c6644" stroke-width="1.4" fill="none"/>
                        <line x1="29" y1="36" x2="39" y2="36" stroke="#475569" stroke-width="1.6" stroke-linecap="round"/>
                    </svg>`;
            }
