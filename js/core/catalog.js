// Laboratory → category → experiment catalogue. New experiments register here
// and provide a module under js/experiments/<id>/ with the same stage workflow.
SAM.catalog = [
  {
    id: 'me',
    name: 'Mechanical Engineering Laboratory',
    groups: [
      {
        name: 'Material Testing',
        items: [
          { id: 'brinell', name: 'Brinell Hardness Test', available: true, route: 'exp/brinell', blurb: 'Ball-indentation hardness of brass, aluminium and mild steel (ISO 6506-1).' },
          { id: 'rockwell', name: 'Rockwell Hardness Test' },
          { id: 'vickers', name: 'Vickers Hardness Test' },
          { id: 'tensile', name: 'Tensile Test (UTM)' },
          { id: 'compression', name: 'Compression Test (UTM)' },
          { id: 'impact', name: 'Impact Test (Izod / Charpy)' },
          { id: 'torsion', name: 'Torsion Test' },
          { id: 'bending', name: 'Bending Test' },
          { id: 'fatigue', name: 'Fatigue Test' },
          { id: 'buckling', name: 'Buckling / Column Test' },
          { id: 'spring', name: 'Spring Test' },
        ],
      },
      {
        name: 'Tribology',
        items: [
          { id: 'wear', name: 'Wear Test (Pin-on-Disc)' },
          { id: 'friction', name: 'Friction Test' },
        ],
      },
      {
        name: 'Thermal & Fluids',
        items: [
          { id: 'heat', name: 'Heat Transfer Experiments' },
          { id: 'fluids', name: 'Fluid Mechanics Experiments' },
          { id: 'thermo', name: 'Thermodynamics Experiments' },
        ],
      },
      {
        name: 'Manufacturing & Metrology',
        items: [
          { id: 'metrology', name: 'Metrology & Measurement' },
          { id: 'manufacturing', name: 'Manufacturing Processes' },
        ],
      },
    ],
  },
];

SAM.experiments = SAM.experiments || {};
