import type images from "./images.json";

type Img = keyof typeof images;

/** Hero photo per CMS page slug (legacy photos from spstrutnov.cz). */
export const pageHeroImage: Record<string, Img> = {
	"charakteristika-a-historie": "studenti-srdicko",
	"partnerstvi-a-spoluprace": "roboticke-pracoviste-wide",
	"volnocasove-aktivity": "stavba-3d-tiskarny",
	"skolska-rada": "banner-spstrutnov",
	"skolni-poradenske-pracoviste": "studentka-tablet-cut",
	"proc-studovat-u-nas": "roboticke-pracoviste",
	stipendium: "frezovani-nas",
	"maturitni-zkousky": "studentka-vyskok",
	"zabezpeceni-vyuky": "pocitacove-site-eps",
	"zakazky-vyroba-opravy-a-montaze": "soustruzeni",
	"volna-mista": "studenti-trika",
	podatelna: "studentka-csi",
	"povinne-zverejnovane-informace": "banner-spstrutnov",
};

/** Optional photo carousel shown under a page's content. */
export const pageGallery: Record<string, Img[]> = {
	"proc-studovat-u-nas": ["roboticke-pracoviste", "sachy-inventor", "soustruzeni", "stavba-3d-tiskarny", "strojirenska-laborator", "pneumatika-plc", "studentka-csi", "studenti-trika"],
	"charakteristika-a-historie": ["studenti-srdicko", "roboticke-pracoviste-wide", "strojirenska-laborator", "pneumatika-plc", "stavba-3d-tiskarny"],
	"volnocasove-aktivity": ["stavba-3d-tiskarny", "slaboprouda-elektrotechnika1", "roboticke-pracoviste", "sachy-inventor"],
};

/** Banner + square photo per study program colour. */
export const programMedia: Record<string, { banner: Img; photo: Img; extra: Img[] }> = {
	eps: { banner: "router-site", photo: "pocitacove-site-eps", extra: ["pocitacove-site-eps", "router-site", "pneumatika-plc"] },
	it: { banner: "studenti-itm", photo: "studentka-tablet", extra: ["studentka-tablet", "adb-small", "studenti-itm"] },
	sle: { banner: "bg-sel", photo: "slaboprouda-elektrotechnika1", extra: ["slaboprouda-elektrotechnika1", "roboticke-pracoviste", "pneumatika-plc"] },
	str: { banner: "bg-str", photo: "strojirenstvi-pocitacova-grafika", extra: ["strojirenstvi-pocitacova-grafika", "sachy-inventor", "stavba-3d-tiskarny", "strojirenska-laborator"] },
	el: { banner: "bg-ele", photo: "elektrikar1", extra: ["elektrikar1", "bg-ele"] },
	na: { banner: "bg-nas", photo: "frezovani-nas", extra: ["frezovani-nas", "soustruzeni", "bg-nas"] },
};
