export const FOLDERS = {
  keimena: {
    name: 'Κείμενα',
    icon: '📁',
    driveId: process.env.FOLDER_KEIMENA
  },
  biblia: {
    name: 'Βιβλία',
    icon: '📚',
    driveId: process.env.FOLDER_BIBLIA
  },
  diktya: {
    name: 'Δίκτυα κειμένων',
    icon: '🔗',
    driveId: process.env.FOLDER_DIKTYA
  },
  epexergasia: {
    name: 'Επεξεργασία',
    icon: '✏️',
    driveId: process.env.FOLDER_EPEXERGASIA
  },
  theoria_glossa: {
    name: 'Θεωρία Ν. Γλώσσας',
    icon: '📖',
    driveId: process.env.FOLDER_THEORIA_GLOSSA
  },
  theoria_logotexnia: {
    name: 'Θεωρία Λογοτεχνίας',
    icon: '📜',
    driveId: process.env.FOLDER_THEORIA_LOGOTEXNIA
  },
  logotexnia: {
    name: 'Λογοτεχνία',
    icon: '🎭',
    driveId: process.env.FOLDER_LOGOTEXNIA
  }
};

export const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
