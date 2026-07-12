# GPS4CAM

*Catégorie : Expériences & cas*

**Plan:** [[2.1 Cycles courts - l'héritage de l'agile et du développement itératif|2.1 Cycles courts : l'héritage de l'agile et du développement itératif]]
**Periode:** 2009-2010
**Rôle(s):** Designer
**Rédigé:** Yes

---

### Ce qui a été fait (descriptif factuelle)

Le projet GPS4CAM concerne une application mobile créée par Michael Diguet, lancée en 2009, au moment où la plupart des photos sont encore prises avec des appareils photo numériques classiques, qui ne disposent pas de GPS intégré. L’objectif de l’application est de permettre le géotaggage des photos, c’est‑à‑dire l’ajout automatique d’une information de localisation (latitude, longitude, et parfois heure) à chaque image, afin de savoir précisément où chaque photo a été prise.

Le fonctionnement de GPS4CAM repose sur une logique simple mais astucieuse : l’utilisateur ouvre l’application sur son iPhone, lance un « trajet » qui enregistre son déplacement grâce au GPS du téléphone, puis, à la fin du voyage, arrête l’enregistrement et génère un code QR sur l’écran. Ce code contient toutes les données de localisation et de chronologie du trajet : les lieux traversés et les moments auxquels l’utilisateur s’y trouvait. L’utilisateur prend ensuite une photo de ce code QR avec son appareil photo numérique, importe ensuite toutes ses photos sur son ordinateur, et utilise un logiciel compagnon (gps4cam Desktop) qui lit le code QR, récupère les données de parcours, puis géotagge automatiquement toutes les autres photos en fonction de la date et de l’heure de prise de vue.

J’ai rencontré Michael Diguet alors que la première version de l’application était déjà publiée sur l’App Store, mais avec des téléchargements très faibles, de l’ordre de quelques dizaines de téléchargements par mois. À l’époque, l’application était vendue autour de 5 euros, ce qui restait nettement moins cher que les modules GPS physiques que les photographes pouvaient acheter pour équiper leur appareil, mais la solution n’avait pas encore trouvé son public. Michael m’a alors demandé de reprendre le projet et de le redessiner complètement, tant sur le plan de l’expérience utilisateur que sur celui de la direction artistique et des parcours d’utilisation.

En concertation avec lui, j’ai repensé à 100% l’expérience utilisateur de l’application, sa logique de navigation, ses écrans, ses gestes et ses feedbacks, ainsi que la direction graphique et la mise en scène des informations. Il s’agit d’une véritable refonte de la version initiale, que l’on peut considérer comme la création d’une V2, même si le cadre méthodologique n’était pas encore explicitement « agile » à l’époque : nous travaillions déjà de manière itérative, à partir de la technologie existante et des premiers retours, mais sans formaliser encore une démarche d’itérations structurées et cycliques.

### Leçon pour le mémoire

Ce cas illustre particulièrement bien la valeur des prototypes et des itérations, même lorsqu’elles ne sont pas formalisées sous le label « méthode agile ». Tu décris GPS4CAM comme une V2, construite à partir d’une version initiale qui avait déjà été lancée, testée et jugée insuffisante en termes d’usage et de diffusion. En repensant l’ensemble de l’expérience utilisateur, tu pratiques en fait une forme de design expérimental : tu observes un échec relatif, tu itères, tu ajustes, et tu observes ensuite l’impact sur les comportements des utilisateurs (ici, le taux de téléchargement et la rétention). Cela correspond exactement à ce que tu analyses dans ton mémoire : la transition d’une logique d’exécution (« on conçoit une version et on la livre ») à une logique d’expérimentation (« on teste, on itère, on apprend, et on ajuste »).

Le projet montre aussi que le design, lorsqu’il est au cœur du produit, peut avoir un impact direct et mesurable sur le succès. Ici, ce n’est pas seulement une campagne de communication qui est redessinée, mais l’ensemble du service numérique : l’interface, la logique de parcours, la lisibilité des feedbacks, la cohérence globale. Cela renforce la thèse selon laquelle, dans des contextes d’incertitude (comme le lancement d’une app de niche), les décisions de design constituent des « paris » sur les usages, qui doivent être confrontés au réel autant de fois que nécessaire.

Enfin, ce cas rejoint tes questions sur la place de l’innovation ouverte et sur la relation entre technologie et design. GPS4CAM existe avant tout grâce à une innovation technique (l’utilisation du GPS d’un smartphone pour géotaguer des photos prises avec un appareil séparé), mais c’est le design qui rend cette technologie accessible, compréhensible et désirée. Il montre que la technologie seule ne suffit pas : c’est en la combinant à une démarche expérimentale de design, centrée sur l’usage, que l’on parvient à transformer un outil technique en un produit réellement utilisé, et durablement.

### Résultat / impact

Suite à cette refonte, la performance de l’application change radicalement. Les ventes passent de quelques dizaines de téléchargements par mois à plusieurs centaines par mois, et certains mois fréquentent voire dépassent le millier de téléchargements, ce que Michael lui‑même qualifie de succès très significatif pour ce type de niche technique. Sur le plan business, l’augmentation de la base d’utilisateurs permet de financer davantage de développement, de maintenance et de communication autour de la marque GPS4CAM.

En parallèle, l’expérience utilisateur est fortement améliorée : l’application devient plus intuitive, plus fluide et plus accessible, notamment pour des photographes amateurs qui ne sont pas forcément à l’aise avec les outils techniques complexes. Les parcours d’usage sont clarifiés, les étapes de géotagage mieux expliquées, et la promesse de « géolocaliser toutes ses photos sans avoir de GPS dans l’appareil » est davantage mise en avant et rendue crédible. Le produit est ainsi perçu comme une solution simple et peu coûteuse, comparé aux modules GPS matériels, ce qui renforce son positionnement sur le marché de la photographie amateur et semi‑pro.

Sur le plan personnel, ce projet est marquant car il constitue l’un des rares cas où l’impact direct du design sur le succès commercial est aussi nettement mesurable : contrairement à bien des projets de communication institutionnelle (comme le coach carbone ou la Sécurité routière), ici, le design est au cœur du produit, et la refonte se traduit par une hausse claire et soutenue des ventes. C’est un cas que tu qualifies toi‑même de quasi exceptionnel, dans le sens où tu n’as encore jamais rencontré un autre projet où le design a eu un effet aussi visible et aussi central sur la croissance.
