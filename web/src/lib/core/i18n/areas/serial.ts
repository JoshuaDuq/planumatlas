// The Linked MRI's serial sections, loaded with the Linked MRI rather than with the page (BUILD-15).
type Plane = 'sagittal' | 'coronal' | 'axial';
const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
const feminine = (plane: string) =>
  (({ sagittal: 'sagittale', coronal: 'coronale', axial: 'axiale' }) as Record<string, string>)[
    plane
  ] ?? plane;

export const en = {
  layout: 'View',
  layouts: { planes: 'Orthogonal views', series: 'Serial sections' },
  spacing: (count: number, spacing: string) => `${count} sections, ${spacing} apart`,
  picture: (plane: Plane, position: string) =>
    `${capital(plane)} section at ${position}. Click to place the crosshair there.`,
  localizer: (count: number, plane: Plane, on: Plane, position: string) =>
    `Where the ${count} ${plane} sections lie, marked on the ${on} section at ${position}.`,
  save: (plane: Plane) => `, ${plane} series`,
  saved: (plane: Plane) => `Saved the ${plane} series as a PNG.`,
  note: (count: number) =>
    `Serial sections: ${count} sections of one plane, evenly spaced across the brain the segmentation labels and drawn at one scale. The first picture marks where they lie.`,
};

export const fr: typeof en = {
  layout: 'Vue',
  layouts: { planes: 'Vues orthogonales', series: 'Coupes sériées' },
  spacing: (count: number, spacing: string) => `${count} coupes, espacées de ${spacing}`,
  picture: (plane: Plane, position: string) =>
    `Coupe ${feminine(plane)} à ${position}. Cliquez pour y placer le réticule.`,
  localizer: (count: number, plane: Plane, on: Plane, position: string) =>
    `Emplacement des ${count} coupes ${feminine(plane)}s, marqué sur la coupe ${feminine(on)} à ${position}.`,
  save: (plane: Plane) => `, série ${feminine(plane)}`,
  saved: (plane: Plane) => `Série ${feminine(plane)} enregistrée au format PNG.`,
  note: (count: number) =>
    `Coupes sériées\u202f: ${count} coupes d’un même plan, régulièrement espacées sur le cerveau que la segmentation étiquette et tracées à la même échelle. La première image indique leur emplacement.`,
};
