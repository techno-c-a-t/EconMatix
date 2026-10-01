#!/usr/bin/env python3
"""
Модуль структуры генеалогического древа экономических учений.
Реализует исторически точные отношения:
- Предок -> Потомок (преемственность течений, например: Марксизм -> Неомарксизм)
- Соседи (конкурирующие взгляды одной эпохи / развилки)
- Виртуальные/пустые вершины (общие исторические проблемы/развилки без одного предка)
"""

GENEALOGY_TREE = {
    "id": "root_economic_thought",
    "name": "История экономической мысли",
    "period": "XVI–XXI вв.",
    "is_virtual": True,
    "description": "Эволюция экономических парадигм от меркантилизма до современной гетеродоксии",
    "children": [
        # Ветвь 1: Ранняя схоластика
        {
            "id": "school_of_salamanca",
            "name": "Саламанкская школа (Поздняя схоластика)",
            "school_id": "school_of_salamanca",
            "period": "XVI в.",
            "is_virtual": False,
            "children": []
        },

        # Ветвь 2: Торговый капитализм и аграрный строй (Развилка: конкурирующие взгляды)
        {
            "id": "branch_early_capitalism",
            "name": "Эпоха первоначального накопления (XVI–XVIII вв.)",
            "period": "XVI–XVIII вв.",
            "is_virtual": True,
            "description": "Два противоположных ответа на природу богатства: торговый протекционизм vs аграрный Laissez-faire",
            "children": [
                {
                    "id": "mercantilism",
                    "name": "Меркантилизм",
                    "school_id": "mercantilism",
                    "period": "XVI–XVIII вв.",
                    "is_virtual": False,
                    "children": []
                },
                {
                    "id": "physiocracy",
                    "name": "Физиократия",
                    "school_id": "physiocracy",
                    "period": "Середина XVIII в.",
                    "is_virtual": False,
                    "children": []
                }
            ]
        },

        # Ветвь 3: Классическая политэкономия и её преемники
        {
            "id": "classical",
            "name": "Классическая политэкономия",
            "school_id": "classical",
            "period": "Конец XVIII – сер. XIX в.",
            "is_virtual": False,
            "description": "Фундамент современной экономической науки (Смит, Рикардо, Милль)",
            "children": [
                # Линия 3.1: Марксистская традиция
                {
                    "id": "marxism",
                    "name": "Марксистская политэкономия",
                    "school_id": "marxism",
                    "period": "Вторая пол. XIX – XX в.",
                    "is_virtual": False,
                    "description": "Критическое продолжение классической трудовой теории стоимости (Маркс, Энгельс)",
                    "children": [
                        {
                            "id": "neo_marxism",
                            "name": "Неомарксизм и мир-системный анализ",
                            "school_id": "neo_marxism",
                            "period": "XX в. – наст. время",
                            "is_virtual": False,
                            "description": "Прямое продолжение марксизма в эпоху монополистического капитала и глобального неравенства",
                            "children": []
                        },
                        {
                            "id": "market_socialism",
                            "name": "Рыночный социализм",
                            "school_id": "market_socialism",
                            "period": "С 1930-х гг.",
                            "is_virtual": False,
                            "description": "Синтез общественной собственности и рыночного механизма ценообразования (Ланге, Лернер)",
                            "children": []
                        }
                    ]
                },

                # Линия 3.2: Немецкая историческая и институциональная школа
                {
                    "id": "old_historical",
                    "name": "Старая немецкая историческая школа",
                    "school_id": "old_historical",
                    "period": "1840–1860-е гг.",
                    "is_virtual": False,
                    "description": "Критика абстрактного космополитизма классиков (Рошер, Книс)",
                    "children": [
                        {
                            "id": "young_historical",
                            "name": "Молодая немецкая историческая школа",
                            "school_id": "young_historical",
                            "period": "1870–1910-е гг.",
                            "is_virtual": False,
                            "description": "Прямое продолжение исторической школы; обоснование социальной политики государства (Шмоллер, Вебер)",
                            "children": [
                                {
                                    "id": "old_institutionalism",
                                    "name": "Традиционный американский институционализм",
                                    "school_id": "old_institutionalism",
                                    "period": "Начало XX в.",
                                    "is_virtual": False,
                                    "description": "Институты, привычки мышления и критика homo oeconomicus (Веблен, Коммонс)",
                                    "children": [
                                        {
                                            "id": "evolutionary",
                                            "name": "Эволюционная экономика",
                                            "school_id": "evolutionary",
                                            "period": "XX в. – наст. время",
                                            "is_virtual": False,
                                            "description": "Инновации, созидательное разрушение и организационные рутины (Шумпетер, Нельсон)",
                                            "children": []
                                        },
                                        {
                                            "id": "behavioral",
                                            "name": "Поведенческая экономика",
                                            "school_id": "behavioral",
                                            "period": "С 1970-х гг.",
                                            "is_virtual": False,
                                            "description": "Психологические основания экономики, ограниченная рациональность (Канеман, Талер)",
                                            "children": []
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },

                # Линия 3.3: Маржиналистская революция 1870-х (Параллельные сестринские школы)
                {
                    "id": "branch_marginalist_revolution",
                    "name": "Маржиналистская революция (1870-е гг.)",
                    "period": "1870-е гг.",
                    "is_virtual": True,
                    "description": "Три параллельных взгляда на субъективную предельную полезность",
                    "children": [
                        {
                            "id": "austrian",
                            "name": "Австрийская школа",
                            "school_id": "austrian",
                            "period": "С 1871 г.",
                            "is_virtual": False,
                            "description": "Субъективизм, праксиология и теория рынка как процесса (Менгер, Мизес, Хайек)",
                            "children": [
                                {
                                    "id": "anarcho_capitalism",
                                    "name": "Анархо-капитализм",
                                    "school_id": "anarcho_capitalism",
                                    "period": "С 1950-х гг.",
                                    "is_virtual": False,
                                    "description": "Радикальное продолжение австрийской школы: ликвидация государства в пользу свободного рынка (Ротбард)",
                                    "children": []
                                }
                            ]
                        },
                        {
                            "id": "lausanne",
                            "name": "Лозаннская школа маржинализма",
                            "school_id": "lausanne",
                            "period": "1870-е гг.",
                            "is_virtual": False,
                            "description": "Математическая теория общего экономического равновесия (Вальрас, Парето)",
                            "children": []
                        },
                        {
                            "id": "cambridge_neoclassical",
                            "name": "Кембриджская неоклассика",
                            "school_id": "cambridge_neoclassical",
                            "period": "Конец XIX – нач. XX в.",
                            "is_virtual": False,
                            "description": "Синтез издержек и полезности («ножницы Маршалла»), частичное равновесие (Маршалл, Пигу)",
                            "children": [
                                {
                                    "id": "new_institutional",
                                    "name": "Новая институциональная экономика",
                                    "school_id": "new_institutional",
                                    "period": "С 1970-х гг.",
                                    "is_virtual": False,
                                    "description": "Синтез неоклассики и институтов: трансакционные издержки и права собственности (Коуз, Норт)",
                                    "children": []
                                }
                            ]
                        }
                    ]
                }
            ]
        },

        # Ветвь 4: Великая депрессия и макростабилизация (1930-е)
        {
            "id": "branch_great_depression",
            "name": "Кризис 1930-х и макроэкономическая революция",
            "period": "1930-е гг.",
            "is_virtual": True,
            "description": "Параллельные ответы на провал рынка в годы Великой депрессии",
            "children": [
                {
                    "id": "stockholm",
                    "name": "Стокгольмская школа",
                    "school_id": "stockholm",
                    "period": "1930-е гг.",
                    "is_virtual": False,
                    "description": "Концепции кумулятивного процесса, ex-ante/ex-post (Викселль, Мюрдаль)",
                    "children": [
                        {
                            "id": "nordic_social_democracy",
                            "name": "Скандинавская социал-демократия (Рен-Мейднер)",
                            "school_id": "nordic_social_democracy",
                            "period": "С 1950-х гг.",
                            "is_virtual": False,
                            "description": "Практическое воплощение шведской модели: солидарная зарплата и государство всеобщего благосостояния",
                            "children": []
                        }
                    ]
                },
                {
                    "id": "ordoliberalism",
                    "name": "Ордолиберализм (Фрайбургская школа)",
                    "school_id": "ordoliberalism",
                    "period": "1930–1950-е гг.",
                    "is_virtual": False,
                    "description": "Социальное рыночное хозяйство: государство как защитник конкурентного правопорядка (Ойкен, Рёпке)",
                    "children": []
                },
                {
                    "id": "original_keynesian",
                    "name": "Оригинальное кейнсианство",
                    "school_id": "original_keynesian",
                    "period": "1936 – 1950-е гг.",
                    "is_virtual": False,
                    "description": "Макроэкономическая революция: неполнота занятости и фискальный стимул (Кейнс)",
                    "children": [
                        {
                            "id": "neoclassical_synthesis",
                            "name": "Неоклассический синтез (Неокейнсианство)",
                            "school_id": "neoclassical_synthesis",
                            "period": "1950–1970-е гг.",
                            "is_virtual": False,
                            "description": "Модель IS-LM, объединение кейнсианства и неоклассики (Самуэльсон, Хикс)",
                            "children": []
                        },
                        {
                            "id": "post_keynesian",
                            "name": "Посткейнсианство",
                            "school_id": "post_keynesian",
                            "period": "С 1960-х гг.",
                            "is_virtual": False,
                            "description": "Фундаментальная неопределенность, эндогенные деньги, нестабильность Мински (Робинсон, Калдор)",
                            "children": [
                                {
                                    "id": "modern_monetary_theory",
                                    "name": "Современная денежная теория (ММТ)",
                                    "school_id": "modern_monetary_theory",
                                    "period": "С 1990-х гг.",
                                    "is_virtual": False,
                                    "description": "Развитие посткейнсианского чартализма: монетарный суверенитет и госгарантия занятости (Мослер, Рэй)",
                                    "children": []
                                }
                            ]
                        },
                        {
                            "id": "new_keynesian",
                            "name": "Новое кейнсианство",
                            "school_id": "new_keynesian",
                            "period": "С 1980-х гг.",
                            "is_virtual": False,
                            "description": "Микрообоснование кейнсианской жесткости цен и зарплат в ответ на критику Лукаса (Стиглиц, Мэнкью)",
                            "children": []
                        }
                    ]
                }
            ]
        },

        # Ветвь 5: Неолиберальная контрреволюция (1960–1980-е)
        {
            "id": "branch_neoliberal_counterrevolution",
            "name": "Неолиберальная контрреволюция",
            "period": "1960–1980-е гг.",
            "is_virtual": True,
            "description": "Реакция на стагфляцию и кризис кейнсианского регулирования",
            "children": [
                {
                    "id": "chicago_monetarism",
                    "name": "Монетаризм (Чикагская школа)",
                    "school_id": "chicago_monetarism",
                    "period": "1950–1980-е гг.",
                    "is_virtual": False,
                    "description": "«Деньги имеют первостепенное значение»: правило k% прироста денежной массы (Фридман)",
                    "children": [
                        {
                            "id": "new_classical",
                            "name": "Новая классическая макроэкономика",
                            "school_id": "new_classical",
                            "period": "С 1970-х гг.",
                            "is_virtual": False,
                            "description": "Прямое развитие чикагской традиции: гипотеза рациональных ожиданий и циклы RBC (Лукас, Сарджент)",
                            "children": []
                        },
                        {
                            "id": "public_choice",
                            "name": "Теория общественного выбора",
                            "school_id": "public_choice",
                            "period": "С 1960-х гг.",
                            "is_virtual": False,
                            "description": "Экономический анализ политики: бюрократия, поиск ренты и «провалы государства» (Бьюкенен, Таллок)",
                            "children": [
                                {
                                    "id": "constitutional_economics",
                                    "name": "Конституционная экономика",
                                    "school_id": "constitutional_economics",
                                    "period": "С 1970-х гг.",
                                    "is_virtual": False,
                                    "description": "Прямое продолжение Public Choice: конституционные правила ограничения власти (Бьюкенен, Ванберг)",
                                    "children": []
                                }
                            ]
                        },
                        {
                            "id": "supply_side",
                            "name": "Экономика предложения",
                            "school_id": "supply_side",
                            "period": "1970–1980-е гг.",
                            "is_virtual": False,
                            "description": "Снижение налогов ради стимулов производства и инвестиций (кривая Лаффера)",
                            "children": []
                        }
                    ]
                }
            ]
        },

        # Ветвь 6: Структурные и гетеродоксные направления
        {
            "id": "branch_heterodoxy_development",
            "name": "Структурные и гетеродоксные парадигмы",
            "period": "Вторая пол. XX – XXI в.",
            "is_virtual": True,
            "description": "Параллельные течения, сфокусированные на развитии, национальном суверенитете, экологии и гендере",
            "children": [
                {
                    "id": "dirigisme",
                    "name": "Французский дирижизм",
                    "school_id": "dirigisme",
                    "period": "1945–1980-е гг.",
                    "is_virtual": False,
                    "children": []
                },
                {
                    "id": "structuralism_eclac",
                    "name": "Латиноамериканский структурализм",
                    "school_id": "structuralism_eclac",
                    "period": "1950–1980-е гг.",
                    "is_virtual": False,
                    "children": []
                },
                {
                    "id": "ecological_economics",
                    "name": "Экологическая экономика",
                    "school_id": "ecological_economics",
                    "period": "С 1970-х гг.",
                    "is_virtual": False,
                    "children": []
                },
                {
                    "id": "feminist_economics",
                    "name": "Феминистская экономика",
                    "school_id": "feminist_economics",
                    "period": "С 1980-х гг.",
                    "is_virtual": False,
                    "children": []
                }
            ]
        }
    ]
}

def get_genealogy_tree():
    return GENEALOGY_TREE

def count_tree_schools(node):
    count = 1 if not node.get("is_virtual", False) else 0
    for child in node.get("children", []):
        count += count_tree_schools(child)
    return count

if __name__ == "__main__":
    c = count_tree_schools(GENEALOGY_TREE)
    print(f"Всего реальных школ в генеалогическом древе: {c}")
    assert c == 34, f"Ожидалось 34 школы, получилось {c}"
