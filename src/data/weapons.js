export function createWeapons(campaign) {
                if (campaign === 'training') {
                    return [
                        { id: 'airsoft_pistol', name: 'AIRSOFT G26 PINK [GBB 6mm]', mag: 15, magMax: 15, reserve: 60, dmg: 28, delay: 165, spread: 0.026, type: 'semi', reloadTime: 1050, recoil: 1.5, bulletSpeed: 2400, isAirsoft: true, color: '#ec4899', unlocked: true },
                        { id: 'rubber_knife', name: 'RUBBER TRAINING KNIFE', mag: 1, magMax: 1, reserve: 0, dmg: 100, delay: 360, spread: 0, type: 'melee', range: 46, reloadTime: 0, recoil: 1.0, bulletSpeed: 0, isAirsoft: true, color: '#f97316', unlocked: true },
                        { id: 'airsoft_aeg', name: 'AIRSOFT M4 CQB [AEG 6mm]', mag: 30, magMax: 30, reserve: 120, dmg: 24, delay: 95, spread: 0.038, type: 'auto', reloadTime: 1500, recoil: 1.8, bulletSpeed: 2750, isAirsoft: true, color: '#334155', unlocked: false }
                    ];
                }
                if (campaign === 'mall') {
                    return [
                        {
                            id: 'glock26',
                            name: 'GLOCK 26 PINK [EXT + RDS]',
                            mag: 15,
                            magMax: 15,
                            reserve: 40,
                            ammoLoad: 'fmj', // 'fmj' (100gr FMJ) | 'jhp' (120gr +P JHP)
                            fmjReserve: 40,
                            jhpReserve: 0,
                            dmg: 40,
                            delay: 170,
                            spread: 0.02,
                            type: 'semi',
                            reloadTime: 1100,
                            recoil: 3.1,
                            bulletSpeed: 4050,
                            color: '#ec4899',
                            unlocked: true
                        },
                        { id: 'knife', name: 'TACTICAL FOLDING BLADE', mag: 1, magMax: 1, reserve: 0, dmg: 85, delay: 380, spread: 0, type: 'melee', range: 46, reloadTime: 0, recoil: 1.4, bulletSpeed: 0, color: '#cbd5e1', unlocked: true },
                        { id: 'shotgun', name: 'SECURITY PUMP SHOTGUN', mag: 8, magMax: 8, reserve: 8, dmg: 26, pellets: 8, delay: 680, spread: 0.2, type: 'semi', reloadTime: 2200, recoil: 9.2, bulletSpeed: 3200, color: '#1e293b', unlocked: false },
                        { id: 'ak47', name: 'CAPTURED KALASHNIKOV', mag: 30, magMax: 30, reserve: 30, dmg: 52, delay: 105, spread: 0.062, type: 'auto', reloadTime: 1950, recoil: 5.6, bulletSpeed: 5400, color: '#78350f', unlocked: false }
                    ];
                }
                if (campaign === 'sniper') {
                    return [
                        { id: 'ruger', name: 'RUGER M77 BOLT-ACTION', mag: 5, magMax: 5, reserve: 30, dmg: 230, delay: 1150, spread: 0.003, type: 'bolt', reloadTime: 2250, recoil: 11.5, bulletSpeed: 6800, pierce: true, color: '#78350f', unlocked: true },
                        { id: 'glock', name: 'GLOCK 17 (9mm)', mag: 17, magMax: 17, reserve: 85, dmg: 38, delay: 180, spread: 0.032, type: 'semi', reloadTime: 1150, recoil: 3.5, bulletSpeed: 3900, color: '#334155', unlocked: true },
                        { id: 'panga', name: 'PANGA MACHETE', mag: 1, magMax: 1, reserve: 0, dmg: 85, delay: 420, spread: 0, type: 'melee', range: 48, reloadTime: 0, recoil: 1.5, bulletSpeed: 0, color: '#94a3b8', unlocked: true },
                        { id: 'shotgun', name: 'PUMP SHOTGUN', mag: 8, magMax: 8, reserve: 24, dmg: 25, pellets: 8, delay: 680, spread: 0.21, type: 'semi', reloadTime: 2200, recoil: 9.0, bulletSpeed: 3200, color: '#1e293b', unlocked: false },
                        { id: 'ar15', name: 'TACTICAL AR-15 (5.56)', mag: 30, magMax: 30, reserve: 120, dmg: 54, delay: 80, spread: 0.022, type: 'auto', reloadTime: 1650, recoil: 4.0, bulletSpeed: 6100, color: '#090d16', unlocked: false }
                    ];
                }
                if (campaign === 'cbd') {
                    return [
                        { id: 'flamethrower', name: 'PORTABLE FLAMETHROWER', mag: 100, magMax: 100, reserve: 300, dmg: 16, delay: 42, spread: 0.14, type: 'flame', reloadTime: 1850, recoil: 1.1, bulletSpeed: 620, color: '#ea580c', unlocked: true },
                        { id: 'glock', name: 'GLOCK 17 (9mm)', mag: 17, magMax: 17, reserve: 85, dmg: 38, delay: 180, spread: 0.032, type: 'semi', reloadTime: 1150, recoil: 3.5, bulletSpeed: 3900, color: '#334155', unlocked: true },
                        { id: 'panga', name: 'PANGA MACHETE', mag: 1, magMax: 1, reserve: 0, dmg: 85, delay: 420, spread: 0, type: 'melee', range: 48, reloadTime: 0, recoil: 1.5, bulletSpeed: 0, color: '#94a3b8', unlocked: true },
                        { id: 'shotgun', name: 'PUMP SHOTGUN', mag: 8, magMax: 8, reserve: 24, dmg: 25, pellets: 8, delay: 680, spread: 0.21, type: 'semi', reloadTime: 2200, recoil: 9.0, bulletSpeed: 3200, color: '#1e293b', unlocked: false },
                        { id: 'ar15', name: 'TACTICAL AR-15 (5.56)', mag: 30, magMax: 30, reserve: 120, dmg: 54, delay: 80, spread: 0.022, type: 'auto', reloadTime: 1650, recoil: 4.0, bulletSpeed: 6100, color: '#090d16', unlocked: false }
                    ];
                }
                return [
                    { id: 'lm4', name: 'VEKTOR LM4 (5.56mm)', mag: 35, magMax: 35, reserve: 105, dmg: 48, delay: 110, spread: 0.038, type: 'auto', reloadTime: 1850, recoil: 4.6, bulletSpeed: 5900, color: '#27272a', unlocked: true },
                    { id: 'glock', name: 'GLOCK 17 (9mm)', mag: 17, magMax: 17, reserve: 68, dmg: 38, delay: 180, spread: 0.032, type: 'semi', reloadTime: 1150, recoil: 3.5, bulletSpeed: 3900, color: '#334155', unlocked: true },
                    { id: 'panga', name: 'PANGA MACHETE', mag: 1, magMax: 1, reserve: 0, dmg: 85, delay: 420, spread: 0, type: 'melee', range: 48, reloadTime: 0, recoil: 1.5, bulletSpeed: 0, color: '#94a3b8', unlocked: true },
                    { id: 'shotgun', name: 'PUMP SHOTGUN', mag: 8, magMax: 8, reserve: 24, dmg: 25, pellets: 8, delay: 680, spread: 0.21, type: 'semi', reloadTime: 2200, recoil: 9.0, bulletSpeed: 3200, color: '#1e293b', unlocked: false },
                    { id: 'ar15', name: 'TACTICAL AR-15 (5.56)', mag: 30, magMax: 30, reserve: 120, dmg: 54, delay: 80, spread: 0.022, type: 'auto', reloadTime: 1650, recoil: 4.0, bulletSpeed: 6100, color: '#090d16', unlocked: false }
                ];
            }
