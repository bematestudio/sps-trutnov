#!/usr/bin/env node
/**
 * Generates seed/seed.json — the EmDash schema + initial content for SPŠ Trutnov.
 *
 *   node scripts/build-seed.mjs
 *
 * Content was migrated from the legacy www.spstrutnov.cz site. Edit the data
 * structures below (or seed/content/*.json) and re-run; after the CMS is set
 * up, editors manage everything in the EmDash admin (/_emdash/admin).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const legacyPosts = JSON.parse(readFileSync(join(root, "seed/content/posts.json"), "utf8"));

// ---------------------------------------------------------------- helpers ---
let keySeq = 0;
const key = () => `k${(keySeq++).toString(36)}`;
const span = (text, marks = []) => ({ _type: "span", _key: key(), text, marks });
const block = (style, text, extra = {}) => ({
	_type: "block",
	_key: key(),
	style,
	markDefs: [],
	children: [span(text)],
	...extra,
});
const p = (text) => block("normal", text);
const h2 = (text) => block("h2", text);
const h3 = (text) => block("h3", text);
const quote = (text) => block("blockquote", text);
const li = (text) => block("normal", text, { listItem: "bullet", level: 1 });
const ol = (text) => block("normal", text, { listItem: "number", level: 1 });
const ul = (items) => items.map(li);
const media = (url, alt, filename) => ({ $media: { url, alt, filename } });

const LEGACY = "https://www.spstrutnov.cz";

// ------------------------------------------------------------- taxonomies ---
const categories = [
	["exkurze-a-vylety", "Exkurze a výlety"],
	["kulturni-akce", "Kulturní akce"],
	["partnerstvi-a-spoluprace", "Partnerství a spolupráce"],
	["prijimaci-rizeni", "Přijímací řízení"],
	["souteze", "Soutěže"],
	["sport", "Sport"],
	["projekty", "Projekty"],
	["ruzne", "Různé"],
	["volnocasove-aktivity", "Volnočasové aktivity"],
];

const tags = [
	["strojirenstvi", "Strojírenství"],
	["slaboproudá-elektrotechnika", "Slaboproudá elektrotechnika"],
	["robotika", "Robotika"],
	["informacni-technologie", "Informační technologie"],
	["elektrikar", "Elektrikář"],
	["nastrojar", "Nástrojař"],
	["atletika", "Atletika"],
	["olympiada", "Olympiáda"],
	["den-otevrenych-dveri", "Den otevřených dveří"],
].map(([slug, label]) => [slug.normalize("NFD").replace(/[̀-ͯ]/g, ""), label]);

// ------------------------------------------------------------------- posts ---
const postTags = {
	"ctyri-nasi-zaci-postoupili-do-krajskeho-kola-logicke-olympiady": ["olympiada", "informacni-technologie"],
	"nasi-zaci-opet-uspeli-v-okresnim-kole-souteze-t-profi-2026": ["slaboprouda-elektrotechnika"],
	"vybojovali-jsme-6-misto-v-republikovem-finale-stredoskolskeho-atletickeho-poharu-v-atletice": ["atletika"],
	"jsme-mistry-kraje-v-atletice-a-jdeme-do-republiky": ["atletika"],
	"jsme-opet-mistry-okresu-v-atletice": ["atletika"],
	"zhledli-jsme-budoucnost-prumyslu-i-humanoidni-roboty-v-akci-na-msv-v-brne": ["robotika", "strojirenstvi"],
	"seznamka-elektrikaru-na-sportovnim-hristi": ["elektrikar"],
	"jak-jsme-se-zabydleli-aneb-adaptacni-program-strojaru": ["strojirenstvi"],
	"kyberbezpecnostni-soutez-cybertron-5-dni-plnych-it-kryptografie-a-novych-zkusenosti": ["informacni-technologie"],
};

const posts = legacyPosts.map((post, index) => {
	const content = [];
	for (const b of post.blocks) {
		if (b.t === "h") content.push(h2(b.x));
		else if (b.t === "li") content.push(li(b.x));
		else content.push(p(b.x));
	}
	const firstParagraph = post.blocks.find((b) => b.t === "p")?.x ?? "";
	const excerpt = firstParagraph.length > 240 ? `${firstParagraph.slice(0, 237).replace(/\s+\S*$/, "")}…` : firstParagraph;
	return {
		id: `post-${index + 1}`,
		slug: post.slug,
		status: "published",
		data: {
			title: post.title,
			excerpt,
			author: post.author,
			published_on: post.date,
			featured: index < 3,
			...(post.image
				? { featured_image: media(post.image, post.title, `${post.slug.slice(0, 60)}.jpg`) }
				: {}),
			content,
		},
		taxonomies: {
			category: [post.category],
			...(postTags[post.slug] ? { tag: postTags[post.slug] } : {}),
		},
	};
});

// ---------------------------------------------------------------- programs ---
const programs = [
	{
		slug: "elektronicke-pocitacove-systemy",
		title: "Elektronické počítačové systémy",
		short_title: "EPS",
		type: "maturita",
		code: "18-20-M/01 Informační technologie",
		svp: "Informační technologie – Elektronické počítačové systémy",
		duration: "4 roky, denní",
		capacity: 30,
		entrance_exam: true,
		health_required: false,
		color: "eps",
		workplace: "Školní 101, Trutnov",
		summary:
			"Správa firemní IT infrastruktury, počítačové sítě, kybernetická bezpečnost a vývoj aplikací — včetně programovatelné elektroniky a internetu věcí.",
		highlights:
			"Návrh a správa počítačových a Wi-Fi sítí\nSpráva síťových prvků, přepínačů a směrovačů\nInstalace a správa operačních systémů\nVývoj desktopových, databázových a webových aplikací",
		careers:
			"Správce operačních systémů\nSprávce počítačových sítí\nVývojář aplikací\nProgramátor vestavěných systémů\nTechnik montáže a diagnostiky počítačů\nPracovník uživatelské podpory",
		content: [
			p("Studijní obor nabízí střední vzdělání technického charakteru zakončené maturitní zkouškou."),
			p(
				"Poskytuje orientaci v informačních technologiích, seznamuje se softwarem a hardwarem počítačů, zaměřuje se zejména na správu firemní infrastruktury a na týmový návrh a vývoj aplikací. Rozšiřující specializací oboru jsou znalosti a práce s programovatelnou elektronikou a s vestavěnými systémy v rámci internetu věcí.",
			),
			p(
				"Odborné předměty pokrývají instalaci a správu operačních systémů, návrh a realizaci počítačových sítí, kybernetickou bezpečnost, montáž a diagnostiku počítačových sestav, vývoj desktopových a online aplikací, práci s databázemi a programování jednodeskových a jednočipových počítačů pro internet věcí.",
			),
			h2("Nadstandardní programy"),
			p("V průběhu studia lze získat celosvětově uznávané certifikáty Cisco Networking Academy, Mikrotik Academy a ECDL."),
		],
		order: 1,
	},
	{
		slug: "informatika-a-management",
		title: "Informatika a management",
		short_title: "IM",
		type: "maturita",
		code: "18-20-M/01 Informační technologie",
		svp: "Informační technologie – Informatika a management",
		duration: "4 roky, denní",
		capacity: 30,
		entrance_exam: true,
		health_required: false,
		color: "it",
		workplace: "Školní 101, Trutnov",
		summary:
			"Spojení IT, grafiky a multimédií s ekonomikou, marketingem a managementem. Weby, video, 2D/3D grafika a profesionální nástroje Adobe.",
		highlights:
			"Podniková ekonomika, marketing a management\nTvorba a správa webů\nVideo, fotografie, 2D a 3D grafika\nPočítačové a Wi-Fi sítě\nAnglický a německý jazyk",
		careers:
			"Webdesigner, správce webu\nGrafik a designér\nSprávce počítačových sítí\nPracovník uživatelské podpory\nManažer IT",
		content: [
			p("Studijní obor poskytuje střední vzdělání technického zaměření s maturitní zkouškou."),
			p(
				"Propojuje znalosti z ekonomiky, práva, managementu a marketingu se schopnostmi v oblasti designu a multimédií, kancelářského software, webdesignu a tvorby webových stránek. Dovednosti jsou postavené na znalostech hardware, operačních systémů a počítačových sítí.",
			),
			p(
				"Absolvent se orientuje v tržní ekonomice, ovládá anglický a německý jazyk v tématech denního života i v oblasti průmyslu a obchodu a zná základní právní normy související s činností firmy.",
			),
			h2("Profesionálové v grafice a multimédiích"),
			p("Ve výuce používáme Adobe Photoshop, Illustrator, InDesign, Premiere Pro, Acrobat a Bridge."),
		],
		order: 2,
	},
	{
		slug: "slaboprouda-elektrotechnika",
		title: "Slaboproudá elektrotechnika",
		short_title: "SLE",
		type: "maturita",
		code: "26-41-M/01 Elektrotechnika",
		svp: "Elektrotechnika – Slaboproudá elektrotechnika",
		duration: "4 roky, denní",
		capacity: 30,
		entrance_exam: true,
		health_required: true,
		color: "sle",
		workplace: "Horská 59, Trutnov",
		summary:
			"Elektronické obvody, mikropočítače, PLC automaty a průmyslové roboty. Automatizace, IoT a moderní spotřební elektronika.",
		highlights:
			"Analýza a návrh analogových i digitálních obvodů\nProgramování mikropočítačů a PLC\nProgramování průmyslových robotů\nAnténní a satelitní technika",
		careers:
			"Projektant elektronických obvodů\nProgramátor automatizovaných pracovišť\nServisní a montážní technik\nPracovník výroby a testování elektroniky",
		content: [
			p("Studijní obor poskytuje střední vzdělání technického zaměření s maturitní zkouškou."),
			p(
				"Odborné předměty jsou zaměřeny na diagnostiku, analýzu a návrh analogových i digitálních elektronických obvodů. Absolvent umí hledat a odstraňovat poruchy s využitím simulačních programů a virtuální měřicí techniky, navrhovat desky plošných spojů, programovat PLC automaty, průmyslové roboty, mikropočítače a zařízení IoT.",
			),
			p(
				"Absolvent oboru splňuje vzdělání pro získání odborné způsobilosti k výkonu činnosti na elektrických zařízeních a odborné způsobilosti v elektrotechnice.",
			),
		],
		order: 3,
	},
	{
		slug: "strojirenstvi-robotika-a-3d-modelovani",
		title: "Strojírenství – robotika a 3D modelování",
		short_title: "STR",
		type: "maturita",
		code: "23-41-M/01 Strojírenství",
		svp: "Strojírenství – robotika a 3D modelování",
		duration: "4 roky, denní",
		capacity: 30,
		entrance_exam: true,
		health_required: false,
		color: "str",
		workplace: "Horská 618, Trutnov",
		summary:
			"Konstrukce v CAD, 3D tisk, programování CNC strojů a průmyslových robotů. Inovované zaměření na robotiku a automatizaci.",
		highlights:
			"Programování průmyslových robotů\nProgramování CNC obráběcích strojů\n3D modelování a tisk\nPevnostní výpočty a volba materiálů",
		careers:
			"Konstruktér a designér\nTechnolog robotických pracovišť\nProgramátor CNC strojů a robotů\nPracovník řízení kvality\nLogistik výrobních linek",
		content: [
			p(
				"Studijní obor poskytuje střední vzdělání technického zaměření s maturitní zkouškou. Seznamuje žáky se širokou oblastí strojírenství, strojírenské výroby a moderních trendů v průmyslové automatizaci.",
			),
			p(
				"Absolvent zvládá konstrukční a technologickou přípravu výroby — výrobní výkresy, sestavy, kusovníky i technologické postupy. Navrhuje materiál a tvar strojních součástí a provádí jejich pevnostní výpočty.",
			),
			p(
				"Významnou částí jeho kompetencí je návrh, integrace a oživení automatizovaných systémů: řídicí programy pro CNC stroje a průmyslové roboty a kontrola kvality výroby.",
			),
		],
		order: 4,
	},
	{
		slug: "elektrikar",
		title: "Elektrikář",
		short_title: "EL",
		type: "vyucni-list",
		code: "26-51-H/01 Elektrikář",
		svp: "Elektrikář",
		duration: "3 roky, denní",
		capacity: 48,
		entrance_exam: false,
		health_required: true,
		color: "el",
		workplace: "Horská 59, Trutnov + Mladé Buky",
		summary:
			"Elektroinstalace budov, servis spotřební a průmyslové elektroniky, zabezpečovací a kamerové systémy. Obor podpořený stipendiem.",
		highlights:
			"Elektrické instalace budov\nÚdržba a opravy měřicí a průmyslové techniky\nSatelitní technika a spotřební elektronika\nZabezpečovací a kamerové systémy",
		careers: "Provozní elektrikář\nElektromontér\nStavební elektrikář\nOpravář elektrických spotřebičů\nElektrotechnik-údržbář",
		content: [
			p(
				"Tříletý učební obor je zaměřen na uplatnění absolventů v oblasti elektrotechniky — spotřební, průmyslové a výpočetní — ve výrobní i servisní sféře a v oblasti elektrických instalací budov.",
			),
			p(
				"Žáci se naučí provádět instalace domovních a průmyslových rozvodů, instalovat satelitní techniku a moderní spotřební elektroniku, budovat Wi-Fi sítě a instalovat zabezpečovací techniku.",
			),
			p("Obor je finančně podpořen stipendiem Královéhradeckého kraje."),
		],
		order: 5,
	},
	{
		slug: "nastrojar",
		title: "Nástrojař",
		short_title: "NA",
		type: "vyucni-list",
		code: "23-52-H/01 Nástrojař",
		svp: "Nástrojař",
		duration: "3 roky, denní",
		capacity: 30,
		entrance_exam: false,
		health_required: true,
		color: "na",
		workplace: "Horská 618, Trutnov + Mladé Buky",
		summary:
			"Výroba a opravy nástrojů a přípravků, soustružení, frézování a programování CNC strojů. Náročný a dobře placený řemeslný obor se stipendiem.",
		highlights: "Výroba a opravy nástrojů a přípravků\nProgramování CNC obráběcích strojů\nTváření za tepla i za studena\nSoustružení a frézování",
		careers: "Nástrojař v kusové i sériové výrobě\nObsluha CNC strojů\nStrojní údržba\nKontrola jakosti\nSamostatná živnost",
		content: [
			p(
				"Tříletý učební obor umožňuje získání vědomostí a praktických dovedností potřebných při strojírenské výrobě a opravách nástrojů, výrobních pomůcek a přípravků v náročné strojírenské výrobě.",
			),
			p(
				"V prvním ročníku si žáci osvojí ruční zpracování kovů, ve druhém náročnější nástrojařské práce a základy strojního obrábění, třetí ročník je věnován práci na CNC obráběcích strojích.",
			),
			p("Obor je finančně podpořen stipendiem Královéhradeckého kraje."),
		],
		order: 6,
	},
].map((program) => ({
	id: `program-${program.slug}`,
	slug: program.slug,
	status: "published",
	data: Object.fromEntries(Object.entries(program).filter(([k]) => k !== "slug")),
}));

// ------------------------------------------------------------------- pages ---
const page = (section, slug, title, lead, content, order = 0) => ({
	id: `page-${section}-${slug}`,
	slug,
	status: "published",
	data: { title, section, lead, content, order },
});

const pages = [
	page(
		"o-skole",
		"charakteristika-a-historie",
		"Charakteristika a historie",
		"Moderní prestižní odborná škola Královéhradeckého kraje s vysokou úrovní technického vybavení — a s historií sahající do roku 1952.",
		[
			h2("Naše vize"),
			p(
				"Střední průmyslová škola je moderní prestižní odborná škola Královéhradeckého kraje s vysokou úrovní technického vybavení a s vysoce odborně kvalifikovanými učiteli.",
			),
			p(
				"Škola průběžně inovuje vzdělávací programy v návaznosti na vývoj moderních technologií ve strojírenství, elektrotechnice, automatizaci a informatice a v souladu s požadavky zaměstnavatelů.",
			),
			quote("Žáci školy jsou zdravě hrdí na svoji školu a svoje dosažené úspěchy."),
			h2("Rozvíjíme hodnoty"),
			...ul([
				"Klima a prostředí — přátelská atmosféra mezi žáky, učiteli a vedením školy.",
				"Důvěra — poctivost, vzájemná důvěra a respekt mezi studenty, rodiči a učiteli.",
				"Hrdost — žáci jsou hrdí na svoji školu a své úspěchy.",
			]),
			h2("Historie školy"),
			...ul([
				"1952 — založena Průmyslová škola pro pracující.",
				"1958 — vznik státní Učňovské školy při Průmyslové škole pro pracující.",
				"1978 — vznik Středního odborného učiliště, zřizovatelem n. p. ZPA Trutnov.",
				"1991 — zavedení denního studia strojírenství a slaboproudé elektrotechniky.",
				"1999 — sloučením COP a SPŠ vzniká největší odborná škola na Trutnovsku.",
				"2006 — škola nese název Střední průmyslová škola, Trutnov, Školní 101.",
			]),
		],
		1,
	),
	page(
		"o-skole",
		"skolska-rada",
		"Školská rada",
		"Orgán školy, který umožňuje zákonným zástupcům, žákům, pedagogům a zřizovateli podílet se na správě školy.",
		[
			h2("Kdo zřizuje radu?"),
			p(
				"Zřizovatel školy, Královéhradecký kraj, stanovil pro naši školu šestičlennou školskou radu. Třetinu členů jmenuje zřizovatel, třetinu volí zákonní zástupci a zletilí žáci, třetinu pedagogičtí pracovníci. Funkční období je tři roky.",
			),
			h2("Činnost rady"),
			...ul([
				"vyjadřuje se k návrhům školních vzdělávacích programů,",
				"schvaluje výroční zprávu, školní řád a stipendijní řád,",
				"schvaluje pravidla pro hodnocení výsledků vzdělávání,",
				"projednává návrh rozpočtu a inspekční zprávy ČŠI.",
			]),
			h2("Členové rady"),
			...ul([
				"RNDr. Ing. Oldřich Horák, Ph.D. — jmenován zřizovatelem",
				"Radek Mráz — jmenován zřizovatelem",
				"Ing. Miloš Zemek — předseda, za pedagogy",
				"Mgr. Šárka Fibikarová — tajemník, za pedagogy",
				"Vlastimil Vykus — za žáky a zákonné zástupce",
				"Marek Zámiš — za žáky a zákonné zástupce",
			]),
		],
		2,
	),
	page(
		"o-skole",
		"volnocasove-aktivity",
		"Volnočasové aktivity",
		"Kroužky, soutěže a kluby, kde žáci rozvíjí talent i mimo vyučování.",
		[
			h2("Kroužky"),
			...ul([
				"Kroužek počítačových sítí (Cisco)",
				"Kroužek elektroniky a mikroprocesorové techniky",
				"Kroužek programování",
				"Kroužek mechatroniky",
				"Kroužek robotiky — platformy Mindstorms a Dynamixel",
				"Kroužek skriptování v PowerShellu",
				"Kroužek strojírenství",
				"Kroužek elektro",
				"Klub zábavné logiky a deskových her",
			]),
			p(
				"Účastníme se celé řady národních i mezinárodních odborných soutěží v oblasti ICT, všeobecně vzdělávacích předmětů a sportu.",
			),
		],
		3,
	),
	page(
		"o-skole",
		"partnerstvi-a-spoluprace",
		"Partnerství a spolupráce",
		"Spolupracujeme s rozhodujícími zaměstnavateli regionu — při praxích, tvorbě učebních plánů i propagaci technického vzdělávání.",
		[
			p(
				"K charakteristickým rysům školy patří dlouhodobá spolupráce s firmami Hitachi, Kasper Kovo, Pepperl+Fuchs, Schaeffler, Siemens, Škoda, TE Connectivity, ZPA Smart Energy a dalšími.",
			),
			p("Firmy se podílejí na odborných praxích, exkurzích, stážích, soutěžích i na vybavení dílen a laboratoří."),
			h2("Centrum odborného vzdělávání"),
			p("Jsme Centrem odborného vzdělávání v elektrotechnice a ICT pro celý Královéhradecký kraj."),
		],
		4,
	),
	page(
		"o-skole",
		"skolni-poradenske-pracoviste",
		"Školní poradenské pracoviště",
		"Výchovné poradenství, prevence a podpora žáků se speciálními vzdělávacími potřebami.",
		[
			p(
				"Školní poradenské pracoviště tvoří výchovný poradce, školní metodik prevence a kariérový poradce. Pomáhá žákům i rodičům při řešení studijních, osobních a kariérních otázek.",
			),
			h2("S čím pomáháme"),
			...ul([
				"studijní obtíže a individuální vzdělávací plány,",
				"podpora žáků se speciálními vzdělávacími potřebami,",
				"prevence rizikového chování,",
				"volba dalšího studia a kariérní poradenství.",
			]),
		],
		5,
	),
	page(
		"studium",
		"stipendium",
		"Stipendium",
		"Ve vybraných oborech můžeš získat až 28 000 Kč ročně (učební obory) a až 30 000 Kč ročně (studijní obory).",
		[
			h2("Stipendium Královéhradeckého kraje"),
			p("Kraj podporuje vyplácením stipendií žáky všech námi nabízených oborů s výučním listem."),
			...ul([
				"1. ročník — měsíčně 300 Kč, odměna za odborný výcvik 1 000 / 500 Kč",
				"2. ročník — měsíčně 400 Kč, odměna za odborný výcvik 2 000 / 1 000 Kč",
				"3. ročník — měsíčně 500 Kč, odměna za odborný výcvik 3 000 / 2 000 Kč",
			]),
			h2("Podmínky"),
			p(
				"Motivační stipendium se vyplácí každý měsíc, pokud žák neopakuje ročník z prospěchových důvodů, nemá neomluvenou absenci, nebylo mu uloženo kázeňské opatření a nemá sníženou známku z chování.",
			),
			h2("Stipendium KASPER KOVO s.r.o."),
			p(
				"Stipendijní program společnosti umožňuje u vybraných oborů poskytnout žákovi až 3 000 Kč měsíčně v nejvyšším ročníku. Podmínkou je nástup do pracovního poměru u společnosti po ukončení studia.",
			),
		],
		3,
	),
	page(
		"studium",
		"proc-studovat-u-nas",
		"Proč studovat u nás",
		"Špičkové vybavení, profesionální software, mezinárodní certifikáty, stipendia a nadprůměrné výsledky maturit.",
		[
			h2("Moderní a špičkové vybavení"),
			...ul([
				"robotická pracoviště a automatizace",
				"CNC obráběcí stroje a jejich programování",
				"programovatelné logické automaty (PLC)",
				"technologie povrchové montáže (SMT)",
				"zabezpečovací systémy a domovní elektroinstalace ABB-free@home",
			]),
			h2("Profesionální programy"),
			p(
				"AutoCAD, Inventor, 3ds Max, Adobe Creative Cloud, LabVIEW, EdgeCAM, FluidSIM a další. Žáci získají řadu licencí zdarma po celou dobu studia.",
			),
			h2("Výsledky maturit nad průměrem"),
			p("Podíl úspěšných z počtu přihlášek: 92,9 % SPŠ Trutnov, 89 % technické SOŠ, 87,5 % ČR (zdroj: Cermat)."),
			h2("Prostupnost mezi obory"),
			p("Žáci mohou přestoupit mezi obory s výučním listem a maturitními obory v závislosti na studijní úspěšnosti."),
		],
		1,
	),
	page(
		"studium",
		"maturitni-zkousky",
		"Maturitní a závěrečné zkoušky",
		"Informace o společné a profilové části maturitní zkoušky a o závěrečných zkouškách učebních oborů.",
		[
			h2("Maturitní zkouška"),
			p(
				"Maturitní zkouška se skládá ze společné části (český jazyk a literatura, cizí jazyk nebo matematika) a profilové části stanovené ředitelem školy podle oboru.",
			),
			h2("Závěrečná zkouška"),
			p(
				"Žáci učebních oborů skládají jednotnou závěrečnou zkoušku — písemnou, praktickou a ústní — a získávají výuční list.",
			),
		],
		4,
	),
	page(
		"studium",
		"zabezpeceni-vyuky",
		"Zabezpečení výuky",
		"Rozvrhy, suplování, studijní průkaz a další praktické informace pro žáky a rodiče.",
		[
			p("Klasifikace, rozvrh a omluvenky jsou dostupné ve Studijním průkazu (Bakaláři)."),
			h2("Pro žáky"),
			...ul(["Studijní průkaz — bakalari.spstrutnov.cz", "Školní e-mail (Microsoft 365)", "Školní data a intranet"]),
		],
		5,
	),
	page(
		"vice",
		"zakazky-vyroba-opravy-a-montaze",
		"Zakázky, výroba, opravy a montáže",
		"Pracoviště praktického vyučování nabízí výrobu, opravy a montáže pro firmy i veřejnost.",
		[
			p(
				"V rámci produktivní činnosti žáků realizujeme kovovýrobu, obrábění na CNC strojích, elektroinstalace a opravy elektrických zařízení. Poptávky vyřizuje pracoviště Mladé Buky 374.",
			),
		],
		1,
	),
	page(
		"vice",
		"volna-mista",
		"Volná místa",
		"Hledáme kolegy do pedagogického sboru i provozu školy.",
		[p("Aktuálně nabízená pracovní místa zveřejňujeme zde. Zájemci mohou zaslat životopis na skola@spstrutnov.cz.")],
		2,
	),
	page(
		"kontakty",
		"podatelna",
		"Podatelna",
		"Elektronická podatelna, datová schránka a úřední hodiny.",
		[
			h2("Elektronická podatelna"),
			p("E-mail: podatelna@spstrutnov.cz"),
			p("Datová schránka: j4px8nw"),
			h2("Úřední hodiny"),
			p("Pracovní dny 7:00–14:00 (přestávka 11:00–12:00)."),
		],
		1,
	),
	page(
		"o-skole",
		"povinne-zverejnovane-informace",
		"Povinně zveřejňované informace",
		"Informace zveřejňované dle zákona č. 106/1999 Sb., o svobodném přístupu k informacím.",
		[
			h2("Název a sídlo"),
			p("Střední průmyslová škola, Trutnov, Školní 101, 541 01 Trutnov. Zřizovatel: Královéhradecký kraj."),
			h2("Identifikace"),
			p("IČ: 69174415 · IZO: 110200403 · RED_IZO: 610200381"),
			h2("Bankovní spojení"),
			p("23537601/0100, Komerční banka, a.s."),
		],
		6,
	),
];

// ------------------------------------------------------------------- people ---
const people = [
	["ing-vladislav-sauer", "Ing. Vladislav Sauer", "ředitel", "vedeni", "Školní 101", "499 814 729", "sauer@spstrutnov.cz"],
	["mgr-jakub-lattenberg", "Mgr. Jakub Lattenberg", "zástupce ředitele pro teoretické vyučování", "vedeni", "Školní 101", "499 813 071", "lattenberg@spstrutnov.cz"],
	["mgr-sarka-fibikarova", "Mgr. Šárka Fibikarová", "zástupkyně ředitele, úsek Horská 618", "vedeni", "Horská 618", "499 813 879", "fibikarova@spstrutnov.cz"],
	["ing-bronislav-gazda", "Ing. Bronislav Gazda", "zástupce ředitele pro teoretické vyučování", "vedeni", "Horská 59", "499 815 145", "gazda@spstrutnov.cz"],
	["arnost-jager", "Arnošt Jäger, DiS.", "zástupce ředitele pro odborný výcvik", "vedeni", "Mladé Buky 374", "499 873 456", "jager@spstrutnov.cz"],
	["bc-jiri-vesely", "Bc. Jiří Veselý", "vedoucí odloučeného pracoviště Mladé Buky", "vedeni", "Mladé Buky 374", "499 873 188", "vesely@spstrutnov.cz"],
	["jana-krupkova", "Jana Krupková", "sekretářka ředitele", "sekretariat", "Školní 101", "499 813 071", "krupkova@spstrutnov.cz"],
	["mgr-tomas-vanek", "Mgr. Tomáš Vaněk", "učitel matematiky", "pedagog", "Školní 101", "499 813 071", "vanek@spstrutnov.cz"],
	["ing-jan-holy", "Ing. Jan Holý", "učitel odborných předmětů", "pedagog", "Horská 59", "499 815 145", "holy@spstrutnov.cz"],
	["mgr-martin-kadrle", "Mgr. Martin Kádrle", "učitel tělesné výchovy", "pedagog", "Horská 618", "499 815 512", "kadrle@spstrutnov.cz"],
	["mgr-zdenka-tezka", "Mgr. Zdeňka Těžká", "učitelka českého jazyka", "pedagog", "Školní 101", "499 813 071", "tezka@spstrutnov.cz"],
	["mgr-martina-pradacova", "Mgr. Martina Pradáčová", "učitelka českého jazyka", "pedagog", "Horská 59", "499 815 145", "pradacova@spstrutnov.cz"],
	["ludek-dusek", "Luděk Dušek", "koordinátor propagace", "pedagog", "Školní 101", "499 813 071", "dusek@spstrutnov.cz"],
	["mgr-jaroslav-kabrhel", "Mgr. Jaroslav Kabrhel", "učitel fyziky", "pedagog", "Horská 618", "499 815 512", "kabrhel@spstrutnov.cz"],
	["mgr-radana-navratova", "Mgr. Radana Návratová", "učitelka tělesné výchovy", "pedagog", "Horská 59", "499 815 145", "navratova@spstrutnov.cz"],
	["ing-horst-anders", "Ing. Horst Anders", "učitel strojírenských předmětů", "pedagog", "Horská 618", "499 815 512", "anders@spstrutnov.cz"],
	["ing-milos-zemek", "Ing. Miloš Zemek", "předseda školské rady, učitel", "pedagog", "Horská 618", "499 815 512", "zemek@spstrutnov.cz"],
].map(([slug, name, role, department, workplace, phone, email], i) => ({
	id: `person-${slug}`,
	slug,
	status: "published",
	data: { name, role, department, workplace, phone, email, order: i + 1 },
}));

// --------------------------------------------------------------- workplaces ---
const workplaces = [
	{
		slug: "skolni-101",
		title: "Školní 101",
		kind: "Sídlo školy · teoretické vyučování",
		address: "Školní 101, 541 01 Trutnov",
		phone: "+420 499 813 071",
		email: "skola@spstrutnov.cz",
		manager: "Ing. Vladislav Sauer, ředitel",
		image: "/images/pracoviste/skolni-101.webp",
		programs: "Elektronické počítačové systémy\nInformatika a management",
		description:
			"Hlavní budova poblíž Krakonošova náměstí. Sídlo ředitelství, 7 učeben, 3 učebny výpočetní techniky a laboratoř elektronických počítačů. Kapacita cca 200 žáků.",
		map_url: "https://mapy.cz/zakladni?q=%C5%A0koln%C3%AD%20101%20Trutnov",
	},
	{
		slug: "horska-618",
		title: "Horská 618",
		kind: "Teoretické vyučování · strojírenství",
		address: "Horská 618, 541 01 Trutnov",
		phone: "+420 499 815 512",
		email: "fibikarova@spstrutnov.cz",
		manager: "Mgr. Šárka Fibikarová, vedoucí učitelka",
		image: "/images/pracoviste/horska-618.webp",
		programs: "Strojírenství – robotika a 3D modelování\nNástrojař",
		description:
			"Pracoviště u sídliště Šestidomí. Strojírenská laboratoř, laboratoř kontroly a měření, 2 učebny výpočetní techniky. Kapacita cca 240 žáků.",
		map_url: "https://mapy.cz/zakladni?q=Horsk%C3%A1%20618%20Trutnov",
	},
	{
		slug: "horska-59",
		title: "Horská 59",
		kind: "Teoretické vyučování · elektro",
		address: "Horská 59, 541 01 Trutnov",
		phone: "+420 499 815 145",
		email: "gazda@spstrutnov.cz",
		manager: "Ing. Bronislav Gazda, zástupce ředitele",
		image: "/images/pracoviste/horska-59.webp",
		programs: "Slaboproudá elektrotechnika\nElektrikář",
		description:
			"Pracoviště v Dolním Starém Městě. Laboratoř elektroniky, číslicové, automatizační a mikroprocesorové techniky, laboratoř fyziky a chemie. Kapacita cca 280 žáků.",
		map_url: "https://mapy.cz/zakladni?q=Horsk%C3%A1%2059%20Trutnov",
	},
	{
		slug: "mlade-buky",
		title: "Mladé Buky 374",
		kind: "Praktické vyučování",
		address: "Mladé Buky 374, 542 23 Mladé Buky",
		phone: "+420 499 873 189",
		email: "jager@spstrutnov.cz",
		manager: "Arnošt Jäger, DiS., zástupce ředitele pro odborný výcvik",
		image: "/images/pracoviste/mlade-buky.webp",
		programs: "Elektronické počítačové systémy\nSlaboproudá elektrotechnika\nStrojírenství – robotika a 3D modelování\nElektrikář\nNástrojař",
		description:
			"Areál pro odborný výcvik mezi Trutnovem a Svobodou nad Úpou: dílny, svařovna, kalírna, kovárna, CNC a robotická pracoviště. Kapacita cca 240 žáků.",
		map_url: "https://mapy.cz/zakladni?q=Mlad%C3%A9%20Buky%20374",
	},
].map((w, i) => ({
	id: `workplace-${w.slug}`,
	slug: w.slug,
	status: "published",
	data: { ...Object.fromEntries(Object.entries(w).filter(([k]) => k !== "slug")), order: i + 1 },
}));

// ------------------------------------------------------------------- events ---
const events = [
	["den-otevrenych-dveri-listopad", "Den otevřených dveří", "2026-11-21T08:00:00.000Z", "2026-11-21T12:00:00.000Z", "Všechna pracoviště školy", "dod", "Ukážeme vám dílny, laboratoře i robotická pracoviště. Na pracovišti v Mladých Bukách čeká dárek zdarma."],
	["krajske-kolo-logicke-olympiady", "Krajské kolo Logické olympiády", "2026-11-06T09:00:00.000Z", "", "Hradec Králové", "skola", "Čtveřice našich postupujících reprezentuje školu v krajském kole."],
	["den-otevrenych-dveri-leden", "Den otevřených dveří", "2027-01-16T08:00:00.000Z", "2027-01-16T12:00:00.000Z", "Všechna pracoviště školy", "dod", "Druhý termín dne otevřených dveří pro uchazeče a jejich rodiče."],
	["kriteria-prijimaciho-rizeni", "Zveřejnění kritérií přijímacího řízení", "2027-01-31T08:00:00.000Z", "", "Web školy", "prijimacky", "Ředitel školy zveřejní kritéria pro první kolo přijímacího řízení."],
	["podani-prihlasek", "Podání přihlášek ke studiu", "2027-02-20T08:00:00.000Z", "", "Elektronicky / podatelna", "prijimacky", "Termín pro podání přihlášek do prvního kola přijímacího řízení."],
	["jpz-1", "Jednotná přijímací zkouška — 1. termín", "2027-04-12T08:00:00.000Z", "", "Dle pozvánky", "prijimacky", "První řádný termín JPZ z češtiny a matematiky."],
	["jpz-2", "Jednotná přijímací zkouška — 2. termín", "2027-04-13T08:00:00.000Z", "", "Dle pozvánky", "prijimacky", "Druhý řádný termín JPZ. Započítává se lepší výsledek."],
].map(([slug, title, starts_at, ends_at, location, kind, description]) => ({
	id: `event-${slug}`,
	slug,
	status: "published",
	data: { title, starts_at, ...(ends_at ? { ends_at } : {}), location, kind, description },
}));

// --------------------------------------------------------------------- faq ---
const faq = [
	["studium", "Co navíc může vaše škola nabídnout?", "Špičkově vybavené laboratoře a dílny, profesionální software zdarma, mezinárodní certifikáty (Cisco, Mikrotik, Autodesk), stipendia a nadprůměrné výsledky maturit. Podrobnosti najdete na stránce Proč studovat u nás."],
	["studium", "Mohou žáci některých oborů získat stipendium?", "Ano. Ve všech oborech s výučním listem (Elektrikář, Nástrojař) mohou žáci získat stipendium až 7 500 Kč ročně od Královéhradeckého kraje. Další podporu až 3 000 Kč měsíčně nabízí u vybraných oborů společnost KASPER KOVO s.r.o."],
	["studium", "Je možný přestup z gymnázia do maturitního oboru?", "Ano, na základě písemné žádosti žáka se souhlasem zákonných zástupců a kopie vysvědčení. Žádost je vhodné podat před termínem 1. kola přijímacího řízení, přestup se uskuteční k 1. 9."],
	["studium", "Lze přestoupit z učebního do maturitního oboru?", "Ano. Žák může pokračovat dvouletým nástavbovým studiem, nebo přestoupit do 2. ročníku maturitního oboru obdobného zaměření (při výborných výsledcích i do 3. ročníku)."],
	["studium", "Mohou si žáci při praxi přivydělat?", "Ano. Při produktivní činnosti na pracovišti praktického vyučování nebo u spolupracujících firem dostávají žáci finanční odměnu."],
	["studium", "Nabízí škola ubytování?", "Ano, v domově mládeže při SOŠ a SOU Trutnov, Úpická 160 (tel. 736 619 536, internat@sou-trutnov.cz), včetně celodenního stravování."],
	["studium", "Mohu školu navštívit i mimo den otevřených dveří?", "Ano, kterékoliv pracoviště. Domluvte se prosím předem s paní Janou Krupkovou, sekretářkou ředitele, na tel. 499 813 071."],
	["prijimaci-rizeni", "Kdy se konají přijímací zkoušky?", "Jednotná přijímací zkouška pro maturitní obory proběhne 12. a 13. dubna 2027, náhradní termíny 29. a 30. dubna 2027. Učební obory přijímací zkoušku nemají."],
	["prijimaci-rizeni", "Kdy jsou zveřejněna kritéria přijímacího řízení?", "Ředitel školy zveřejňuje kritéria pro první kolo do 31. ledna."],
	["prijimaci-rizeni", "Co když budu přijat na dvě školy?", "Na vybranou školu odevzdáte do 10 pracovních dnů od zveřejnění výsledků zápisový lístek. Ostatním školám nic oznamovat nemusíte."],
	["prijimaci-rizeni", "Jak uvést obory EPS a IM na přihlášce?", "Oba obory mají stejný kód 18-20-M/01 Informační technologie. Na přihlášku uveďte kód a do názvu i název školního vzdělávacího programu (Elektronické počítačové systémy, resp. Informatika a management)."],
	["prijimaci-rizeni", "Zohledňujete uchazeče se SVP?", "Ano, uchazečům se speciálními vzdělávacími potřebami se prodlužuje časový limit podle doporučení školského poradenského zařízení."],
].map(([group, question, answer], i) => ({
	id: `faq-${i + 1}`,
	slug: `faq-${i + 1}`,
	status: "published",
	data: { question, answer, group, order: i + 1 },
}));

// --------------------------------------------------------------- documents ---
const documents = [
	["Školní vzdělávací program — Elektronické počítačové systémy", "studium", "PDF", "1,2 MB", "2026/2027"],
	["Školní vzdělávací program — Informatika a management", "studium", "PDF", "1,1 MB", "2026/2027"],
	["Školní vzdělávací program — Slaboproudá elektrotechnika", "studium", "PDF", "1,3 MB", "2026/2027"],
	["Školní vzdělávací program — Strojírenství", "studium", "PDF", "1,4 MB", "2026/2027"],
	["Kritéria přijímacího řízení 2027", "prijimaci-rizeni", "PDF", "240 kB", "2026/2027"],
	["Lékařský posudek o zdravotní způsobilosti — vzor", "prijimaci-rizeni", "PDF", "90 kB", "2026/2027"],
	["Výpis z informačního systému školy — vzor", "prijimaci-rizeni", "PDF", "70 kB", "2026/2027"],
	["Omluvný list", "formulare", "PDF", "60 kB", ""],
	["Žádost o uvolnění z vyučování", "formulare", "DOCX", "40 kB", ""],
	["Žádost o přístup k osobním informacím", "formulare", "PDF", "80 kB", ""],
	["Výroční zpráva o činnosti školy 2025/2026", "dokumenty", "PDF", "3,4 MB", "2025/2026"],
	["Školní řád", "dokumenty", "PDF", "520 kB", "2026/2027"],
	["Rozpočet školy 2026", "dokumenty", "PDF", "180 kB", "2026"],
	["Postup při vyřizování žádostí dle zákona 106/1999 Sb.", "dokumenty", "PDF", "110 kB", ""],
	["Informační zpravodaj — podzim 2026", "propagace", "PDF", "6,8 MB", "2026/2027"],
	["Zápis ze zasedání školské rady — říjen 2026", "skolska-rada", "PDF", "150 kB", "2026/2027"],
].map(([title, category, file_type, size, year], i) => ({
	id: `doc-${i + 1}`,
	slug: `dokument-${i + 1}`,
	status: "published",
	data: { title, category, file_type, size, year, file_url: `${LEGACY}/ke-stazeni`, order: i + 1 },
}));

// ---------------------------------------------------------------- partners ---
const partners = [
	["Hitachi Energy", "hitachi-energy", "https://www.hitachienergy.com"],
	["Kasper", "kasper", "https://www.kasperkovo.cz"],
	["Pepperl+Fuchs", "pepperl-fuchs", "https://www.pepperl-fuchs.com"],
	["Schaeffler", "schaeffler", "https://www.schaeffler.cz"],
	["Siemens", "siemens", "https://www.siemens.cz"],
	["Škoda Auto", "skoda", "https://www.skoda-auto.cz"],
	["TE Connectivity", "te", "https://www.te.com"],
	["ZPA Smart Energy", "zpa", "https://www.zpa-smartenergy.cz"],
].map(([name, file, url], i) => ({
	id: `partner-${i + 1}`,
	slug: file,
	status: "published",
	data: { name, url, order: i + 1, logo: media(`${LEGACY}/images/loga/${file}.png`, name, `${file}.png`) },
}));

// ------------------------------------------------------------------ videos ---
const videos = [
	["KfWKXbyp-84", "Praktické vyučování na SPŠ Trutnov", "Dílny, CNC a robotická pracoviště v Mladých Bukách."],
	["MLgdvbE7O10", "Výrobní linka domina", "Automatizovaná linka postavená žáky — PLC, pneumatika a robotika."],
	["FGZwrPVA2V8", "Kroužek robotiky", "Stavíme a programujeme roboty na platformách Mindstorms a Dynamixel."],
	["Bs04LgQfk_Q", "Kroužek mechatroniky", "Návrh, realizace a propagace vlastních mechatronických zařízení."],
].map(([youtube_id, title, description], i) => ({
	id: `video-${i + 1}`,
	slug: youtube_id.toLowerCase().replace(/[^a-z0-9]/g, ""),
	status: "published",
	data: { title, youtube_id, description, order: i + 1 },
}));

// -------------------------------------------------------------- collections ---
const f = (slug, label, type, extra = {}) => ({ slug, label, type, ...extra });

const seed = {
	$schema: "https://emdashcms.com/seed.schema.json",
	version: "1",
	meta: {
		name: "SPŠ Trutnov",
		description: "Web Střední průmyslové školy, Trutnov, Školní 101",
		author: "SPŠ Trutnov",
	},
	settings: {
		title: "SPŠ Trutnov",
		tagline: "Střední průmyslová škola, Trutnov, Školní 101 — technické vzdělání s budoucností.",
		timezone: "Europe/Prague",
	},
	collections: [
		{
			slug: "posts",
			label: "Novinky",
			labelSingular: "Novinka",
			urlPattern: "/novinky/{slug}",
			supports: ["drafts", "revisions", "preview", "scheduling", "search", "seo"],
			fields: [
				f("title", "Titulek", "string", { required: true, searchable: true }),
				f("excerpt", "Perex", "text", { searchable: true }),
				f("featured_image", "Hlavní obrázek", "image"),
				f("author", "Autor", "string"),
				f("published_on", "Datum publikace", "datetime"),
				f("featured", "Zvýraznit na úvodní stránce", "boolean"),
				f("content", "Obsah", "portableText", { searchable: true }),
			],
		},
		{
			slug: "pages",
			label: "Stránky",
			labelSingular: "Stránka",
			urlPattern: "/{slug}",
			supports: ["drafts", "revisions", "preview", "search", "seo"],
			fields: [
				f("title", "Titulek", "string", { required: true, searchable: true }),
				f("section", "Sekce webu", "select", {
					required: true,
					validation: { options: ["o-skole", "studium", "kontakty", "vice"] },
				}),
				f("lead", "Úvodní text", "text", { searchable: true }),
				f("content", "Obsah", "portableText", { searchable: true }),
				f("order", "Pořadí v menu", "integer"),
			],
		},
		{
			slug: "programs",
			label: "Obory vzdělání",
			labelSingular: "Obor",
			urlPattern: "/studium/obory-vzdelani/{slug}",
			supports: ["drafts", "revisions", "search", "seo"],
			fields: [
				f("title", "Název oboru", "string", { required: true, searchable: true }),
				f("short_title", "Zkratka", "string"),
				f("type", "Typ", "select", { required: true, validation: { options: ["maturita", "vyucni-list"] } }),
				f("code", "Kód a název oboru", "string"),
				f("svp", "Školní vzdělávací program", "string"),
				f("duration", "Délka a forma", "string"),
				f("capacity", "Počet přijímaných", "integer"),
				f("entrance_exam", "Přijímací zkouška", "boolean"),
				f("health_required", "Zdravotní způsobilost", "boolean"),
				f("color", "Barva", "select", { validation: { options: ["eps", "it", "sle", "str", "el", "na"] } }),
				f("workplace", "Pracoviště", "string"),
				f("summary", "Shrnutí", "text", { searchable: true }),
				f("highlights", "Co se naučíš (1 řádek = 1 bod)", "text"),
				f("careers", "Uplatnění (1 řádek = 1 pozice)", "text"),
				f("content", "Popis", "portableText", { searchable: true }),
				f("order", "Pořadí", "integer"),
			],
		},
		{
			slug: "events",
			label: "Akce a termíny",
			labelSingular: "Akce",
			supports: ["drafts", "search"],
			fields: [
				f("title", "Název", "string", { required: true, searchable: true }),
				f("starts_at", "Začátek", "datetime", { required: true }),
				f("ends_at", "Konec", "datetime"),
				f("location", "Místo", "string"),
				f("kind", "Typ", "select", { validation: { options: ["dod", "prijimacky", "skola", "sport"] } }),
				f("description", "Popis", "text", { searchable: true }),
			],
		},
		{
			slug: "people",
			label: "Lidé",
			labelSingular: "Osoba",
			supports: ["drafts", "search"],
			fields: [
				f("name", "Jméno", "string", { required: true, searchable: true }),
				f("role", "Funkce", "string", { searchable: true }),
				f("department", "Útvar", "select", {
					validation: { options: ["vedeni", "sekretariat", "pedagog", "poradenstvi", "provoz"] },
				}),
				f("workplace", "Pracoviště", "string"),
				f("phone", "Telefon", "string"),
				f("email", "E-mail", "string"),
				f("order", "Pořadí", "integer"),
			],
		},
		{
			slug: "workplaces",
			label: "Pracoviště",
			labelSingular: "Pracoviště",
			supports: ["drafts"],
			fields: [
				f("title", "Název", "string", { required: true }),
				f("kind", "Typ pracoviště", "string"),
				f("address", "Adresa", "string"),
				f("phone", "Telefon", "string"),
				f("email", "E-mail", "string"),
				f("manager", "Vedoucí", "string"),
				f("image", "Fotografie (URL)", "string"),
				f("programs", "Obory (1 řádek = 1 obor)", "text"),
				f("description", "Popis", "text"),
				f("map_url", "Odkaz na mapu", "url"),
				f("order", "Pořadí", "integer"),
			],
		},
		{
			slug: "faq",
			label: "Časté dotazy",
			labelSingular: "Dotaz",
			supports: ["drafts", "search"],
			fields: [
				f("question", "Otázka", "string", { required: true, searchable: true }),
				f("answer", "Odpověď", "text", { searchable: true }),
				f("group", "Skupina", "select", { validation: { options: ["studium", "prijimaci-rizeni"] } }),
				f("order", "Pořadí", "integer"),
			],
		},
		{
			slug: "documents",
			label: "Dokumenty ke stažení",
			labelSingular: "Dokument",
			supports: ["drafts", "search"],
			fields: [
				f("title", "Název", "string", { required: true, searchable: true }),
				f("category", "Kategorie", "select", {
					validation: { options: ["studium", "prijimaci-rizeni", "formulare", "dokumenty", "propagace", "skolska-rada"] },
				}),
				f("file", "Soubor", "file"),
				f("file_url", "Externí odkaz na soubor", "url"),
				f("file_type", "Typ souboru", "string"),
				f("size", "Velikost", "string"),
				f("year", "Školní rok", "string"),
				f("order", "Pořadí", "integer"),
			],
		},
		{
			slug: "videos",
			label: "Videa",
			labelSingular: "Video",
			supports: ["drafts"],
			fields: [
				f("title", "Název", "string", { required: true }),
				f("youtube_id", "YouTube ID videa", "string", { required: true }),
				f("description", "Popis", "text"),
				f("order", "Pořadí", "integer"),
			],
		},
		{
			slug: "partners",
			label: "Partneři",
			labelSingular: "Partner",
			supports: ["drafts"],
			fields: [
				f("name", "Název firmy", "string", { required: true }),
				f("logo", "Logo", "image"),
				f("url", "Web", "url"),
				f("order", "Pořadí", "integer"),
			],
		},
	],
	taxonomies: [
		{
			name: "category",
			label: "Kategorie novinek",
			labelSingular: "Kategorie",
			hierarchical: true,
			collections: ["posts"],
			terms: categories.map(([slug, label]) => ({ slug, label })),
		},
		{
			name: "tag",
			label: "Štítky",
			labelSingular: "Štítek",
			hierarchical: false,
			collections: ["posts"],
			terms: tags.map(([slug, label]) => ({ slug, label })),
		},
	],
	menus: [
		{
			name: "primary",
			label: "Hlavní navigace",
			items: [
				{ type: "custom", label: "Novinky", url: "/novinky" },
				{
					type: "custom",
					label: "Studium",
					url: "/studium",
					children: [
						{ type: "custom", label: "Obory vzdělání", url: "/studium/obory-vzdelani" },
						{ type: "custom", label: "Přijímací řízení", url: "/studium/prijimaci-rizeni" },
						{ type: "custom", label: "Den otevřených dveří", url: "/studium/den-otevrenych-dveri" },
						{ type: "custom", label: "Proč studovat u nás", url: "/studium/proc-studovat-u-nas" },
						{ type: "custom", label: "Stipendium", url: "/studium/stipendium" },
						{ type: "custom", label: "Časté dotazy", url: "/studium/casto-kladene-dotazy" },
						{ type: "custom", label: "Maturitní a závěrečné zkoušky", url: "/studium/maturitni-zkousky" },
					],
				},
				{
					type: "custom",
					label: "O škole",
					url: "/o-skole",
					children: [
						{ type: "custom", label: "Charakteristika a historie", url: "/o-skole/charakteristika-a-historie" },
						{ type: "custom", label: "Pracoviště", url: "/o-skole/pracoviste" },
						{ type: "custom", label: "Partnerství a spolupráce", url: "/o-skole/partnerstvi-a-spoluprace" },
						{ type: "custom", label: "Volnočasové aktivity", url: "/o-skole/volnocasove-aktivity" },
						{ type: "custom", label: "Školská rada", url: "/o-skole/skolska-rada" },
						{ type: "custom", label: "Školní poradenské pracoviště", url: "/o-skole/skolni-poradenske-pracoviste" },
						{ type: "custom", label: "Povinně zveřejňované informace", url: "/o-skole/povinne-zverejnovane-informace" },
					],
				},
				{ type: "custom", label: "Galerie", url: "/galerie" },
				{ type: "custom", label: "Ke stažení", url: "/ke-stazeni" },
				{
					type: "custom",
					label: "Kontakty",
					url: "/kontakty",
					children: [
						{ type: "custom", label: "Sídlo a pracoviště", url: "/kontakty" },
						{ type: "custom", label: "Lidé", url: "/kontakty/lide" },
						{ type: "custom", label: "Podatelna", url: "/kontakty/podatelna" },
					],
				},
			],
		},
	],
	content: { posts, pages, programs, events, people, workplaces, faq, documents, partners, videos },
};

writeFileSync(join(root, "seed/seed.json"), `${JSON.stringify(seed, null, "\t")}\n`);
console.log(
	`seed/seed.json written: ${Object.entries(seed.content)
		.map(([k, v]) => `${k}=${v.length}`)
		.join(", ")}`,
);
