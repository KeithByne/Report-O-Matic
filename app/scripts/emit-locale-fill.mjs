/** Emits src/lib/i18n/localeUiFill.ts — ES/FR/EL strings for keys missing from ES & FR overrides. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const entries = [
  ["brand.subtitle", "Report-O-Matic", "Report-O-Matic", "Report-O-Matic"],
  ["timetable.dayColumn", "Día", "Jour", "Ημέρα"],
  ["timetable.slotMetaLine", "{weekday} · periodo {period} de {total} · fila de aula {room}", "{weekday} · période {period} sur {total} · rangée salle {room}", "{weekday} · περίοδος {period} από {total} · σειρά αίθουσας {room}"],
  ["common.retry", "Reintentar", "Réessayer", "Επανάληψη"],

  ["dash.ownerCreditsTitle", "Créditos de informes (su cuenta)", "Crédits de rapports (votre compte)", "Πιστώσεις αναφορών (ο λογαριασμός σας)"],
  ["dash.ownerCreditsRemaining", "{n} informes restantes", "{n} rapports restants", "{n} αναφορές απομένουν"],
  ["dash.ownerCreditsHint", "Al comprar un pack, los créditos se suman a su cuenta de propietario y las comparten todas sus escuelas — no por escuela.", "Quand vous achetez un pack, les crédits sont ajoutés à votre compte propriétaire et partagés entre toutes vos écoles — pas par école.", "Όταν αγοράζετε πακέτο, οι πιστώσεις προστίθενται στον λογαριασμό ιδιοκτήτη και μοιράζονται μεταξύ όλων των σχολείων σας — όχι ανά σχολείο."],
  ["dash.ownerCreditsBuy", "Comprar créditos", "Acheter des crédits", "Αγορά πιστώσεων"],
  ["dash.agentSectionTitle", "Propietario / Agente", "Propriétaire / Agent", "Ιδιοκτήτης / Πράκτορας"],
  ["dash.agentSectionLead", "Su enlace de referido y comisiones. Configure Stripe cuando esté listo.", "Votre lien de parrainage et commissions. Configurez Stripe quand vous êtes prêt.", "Ο σύνδεσμος παραπομπής σας και προμήθειες. Ρυθμίστε το Stripe όταν είστε έτοιμοι."],
  ["dash.agentRefresh", "Actualizar", "Actualiser", "Ανανέωση"],
  ["dash.agentRefreshing", "Actualizando…", "Actualisation…", "Ανανέωση…"],
  ["dash.agentPaymentsBlurb", "Pagos. Su cuenta de agente debe estar activa para cobrar. Si permanece inactiva unos doce meses, puede cancelarse.", "Paiements. Votre compte agent doit être actif pour être payé. S'il reste inactif environ un an, il peut être résilié.", "Πληρωμές. Ο λογαριασμός πράκτορα πρέπει να είναι ενεργός για πληρωμή. Αν μείνει ανενεργός περίπου έναν χρόνο, μπορεί να ακυρωθεί."],
  ["dash.agentLinkLabel", "Su enlace de agente", "Votre lien agent", "Ο σύνδεσμός σας πράκτορα"],
  ["dash.agentLinkShareHint", "Compártalo con nuevos propietarios de escuela.", "Partagez-le avec les nouveaux propriétaires d'école.", "Μοιραστείτε το με νέους ιδιοκτήτες σχολείων."],
  ["dash.agentCommissionLabel", "Tipo de comisión:", "Taux de commission :", "Ποσοστό προμήθειας:"],
  ["dash.agentStripeLabel", "ID de cuenta Stripe Connect (cobro)", "ID de compte Stripe Connect (paiement)", "Αναγνωριστικό λογαριασμού Stripe Connect (πληρωμή)"],
  ["dash.agentSave", "Guardar", "Enregistrer", "Αποθήκευση"],
  ["dash.agentSaving", "Guardando…", "Enregistrement…", "Αποθήκευση…"],
  ["dash.agentReset", "Restablecer", "Réinitialiser", "Επαναφορά"],
  ["dash.agentLoading", "Cargando…", "Chargement…", "Φόρτωση…"],
  ["dash.statTeachers", "Profesores", "Enseignants", "Εκπαιδευτικοί"],
  ["dash.statClasses", "Clases", "Classes", "Τάξεις"],
  ["dash.statStudents", "Alumnos", "Élèves", "Μαθητές"],
  ["dash.statReportsRendered", "Informes generados", "Rapports générés", "Δημιουργημένες αναφορές"],
  ["dash.downloadSchoolDataExcel", "Descargar datos (Excel)", "Télécharger les données (Excel)", "Λήψη δεδομένων σχολείου (Excel)"],
  ["dash.timetable", "Horario", "Emploi du temps", "Ωρολόγιο πρόγραμμα"],
  ["dash.timetablePrint", "Imprimir horario (PDF)", "Imprimer l'emploi du temps (PDF)", "Εκτύπωση ωρολογίου (PDF)"],
  ["dash.myTimetable", "Mi horario", "Mon emploi du temps", "Το ωρολόγιό μου"],
  ["dash.myTimetablePrint", "Imprimir mi horario (PDF)", "Imprimer mon emploi du temps (PDF)", "Εκτύπωση του ωρολογίου μου (PDF)"],
  ["dash.timetableRoomsLabel", "Aulas", "Salles", "Αίθουσες"],
  ["dash.timetablePeriodsAmLabel", "Periodos antes del almuerzo", "Cours avant le déjeuner", "Περίοδοι πριν το μεσημεριανό"],
  ["dash.timetablePeriodsPmLabel", "Periodos después del almuerzo", "Cours après le déjeuner", "Περίοδοι μετά το μεσημεριανό"],
  ["dash.timetableSaveLayout", "Guardar diseño", "Enregistrer la grille", "Αποθήκευση διάταξης"],
  ["dash.timetableSavingLayout", "Guardando…", "Enregistrement…", "Αποθήκευση…"],
  ["dash.timetableLayoutSaved", "Diseño guardado.", "Grille enregistrée.", "Η διάταξη αποθηκεύτηκε."],
  ["invite.firstName", "Nombre(s) del profesor", "Prénom(s) de l'enseignant", "Όνομα(τα) εκπαιδευτικού"],
  ["invite.lastName", "Apellido(s) del profesor", "Nom(s) de l'enseignant", "Επώνυμο(α) εκπαιδευτικού"],
  ["invite.firstNamePlaceholder", "p. ej. Alex", "ex. Alex", "π.χ. Αλέξης"],
  ["invite.lastNamePlaceholder", "p. ej. García", "ex. Dupont", "π.χ. Παπαδόπουλος"],
  ["roster.thClasses", "Clases", "Classes", "Τάξεις"],
  ["roster.thStudents", "Alumnos", "Élèves", "Μαθητές"],
  ["roster.thReportsTerms", "Informes (T1/T2/T3)", "Rapports (T1/T2/T3)", "Αναφορές (T1/T2/T3)"],
  ["roster.thStudentsMove", "Alumnos (A/E/M)", "Élèves (A/D/Dépl.)", "Μαθητές (Π/Δ/Μτβ)"],
  ["roster.roleOwner", "Propietario", "Propriétaire", "Ιδιοκτήτης"],
  ["roster.roleTeacher", "Profesor", "Enseignant", "Εκπαιδευτικός"],
  ["class.bulkPdfOrderLabel", "Orden", "Ordre", "Σειρά"],
  ["class.orderClassRoster", "Lista de la clase", "Liste de la classe", "Κατάσταση τάξης"],
  ["class.orderStudentName", "Nombre del alumno", "Nom de l'élève", "Όνομα μαθητή"],
  ["class.orderUpdatedDesc", "Última actualización (más reciente)", "Dernière mise à jour (récent d'abord)", "Τελευταία ενημέρωση (νεότερα πρώτα)"],
  ["class.orderUpdatedAsc", "Última actualización (más antigua)", "Dernière mise à jour (ancien d'abord)", "Τελευταία ενημέρωση (παλαιότερα πρώτα)"],
  ["class.orderClass", "Clase (A-Z)", "Classe (A-Z)", "Τάξη (Α-Ω)"],
  ["class.downloadClassPdfsOneFile", "Descargar PDF de la clase (un archivo)", "Télécharger les PDF de la classe (un fichier)", "Λήψη PDF τάξης (ένα αρχείο)"],
  ["class.genderFemale", "Mujer", "Femme", "Γυναίκα"],
  ["class.genderNonBinaryOpt", "No binario", "Non-binaire", "Μη δυαδικό"],
  ["class.genderMale", "Hombre", "Homme", "Άνδρας"],
  ["class.movePupilSectionTitle", "Mover alumno a otra clase", "Déplacer un élève vers une autre classe", "Μετακίνηση μαθητή σε άλλη τάξη"],
  ["class.movePupilLabel", "Alumno", "Élève", "Μαθητής"],
  ["class.moveDestinationLabel", "Clase de destino", "Classe de destination", "Τάξη προορισμού"],
  ["class.movePupilButton", "Mover alumno", "Déplacer l'élève", "Μετακίνηση μαθητή"],
  ["class.movePupilFootnote", "Se conservan los informes; se registra el traslado para estadísticas.", "Les rapports sont conservés ; un événement « déplacé » est enregistré pour les statistiques.", "Οι αναφορές διατηρούνται· καταγράφεται η μετακίνηση για τα στατιστικά."],
  ["class.bulkPdfNotFinished", "No puede descargar todos los informes hasta que estén terminados.", "Vous ne pouvez pas tout télécharger tant que les rapports ne sont pas terminés.", "Δεν μπορείτε να τα κατεβάσετε όλα μέχρι να ολοκληρωθούν οι αναφορές."],
  ["class.bulkPdfNotFinishedTerm", "Cada alumno necesita un informe finalizado del trimestre elegido.", "Chaque élève doit avoir un rapport terminé pour le trimestre choisi.", "Κάθε μαθητής χρειάζεται ολοκληρωμένη αναφορά για την επιλεγμένη περίοδο."],
  ["class.bulkPdfNeedStudents", "Añada alumnos antes de descargar el PDF combinado.", "Ajoutez des élèves avant de télécharger le PDF combiné.", "Προσθέστε μαθητές πριν από τη λήψη του σύνθετου PDF."],
  ["class.firstLastRequired", "Nombre y apellidos obligatorios.", "Prénom et nom obligatoires.", "Υποχρεωτικό όνομα και επώνυμο."],
  ["class.movePickOtherClass", "Elija otra clase de destino.", "Choisissez une autre classe de destination.", "Επιλέξτε διαφορετική τάξη προορισμού."],
  ["class.moveConfirm", "¿Mover a {who} a {dest}? Sus informes se moverán con ellos.", "Déplacer {who} vers {dest} ? Ses rapports suivront.", "Μετακίνηση {who} στην {dest}; Οι αναφορές τους θα μεταφερθούν."],

  ["timetable.title", "Horario", "Emploi du temps", "Ωρολόγιο πρόγραμμα"],
  ["timetable.leadIntro", "Defina aulas y periodos. Haga clic en una celda para asignar clase; el profesor viene de la ficha de clase.", "Définissez les salles et les créneaux. Cliquez pour assigner une classe ; l'enseignant vient de la fiche classe.", "Ορίστε αίθουσες και περιόδους. Κάντε κλικ σε κελί για ανάθεση τάξης· ο εκπαιδευτικός προέρχεται από την κάρτα τάξης."],
  ["timetable.teacherIntro", "Sus clases aparecen abajo. Jefes y propietarios montan el horario completo.", "Vos cours apparaissent ci-deshyphensous. Les chefs et propriétaires construisent l'emploi du temps complet.", "Τα μαθήματά σας εμφανίζονται παρακάτω. Οι υπεύθυνοι χτίζουν το πλήρες ωρολόγιο."],
  ["timetable.lunch", "Almuerzo", "Déjeuner", "Διάλειμμα φαγητού"],
  ["timetable.editCell", "Lección en este hueco", "Cours sur ce créneau", "Μάθημα σε αυτή τη θέση"],
  ["timetable.class", "Clase", "Classe", "Τάξη"],
  ["timetable.teacher", "Profesor", "Enseignant", "Εκπαιδευτικός"],
  ["timetable.roomRow", "Fila de aula", "Rangée salle", "Σειρά αίθουσας"],
  ["timetable.clearSlot", "Vaciar hueco", "Vider le créneau", "Καθαρισμός θέσης"],
  ["timetable.saveSlot", "Guardar", "Enregistrer", "Αποθήκευση"],
  ["timetable.goToClass", "Ir a la clase", "Aller à la classe", "Μετάβαση στην τάξη"],
  ["timetable.cancel", "Cancelar", "Annuler", "Ακύρωση"],
  ["timetable.emptyCell", "Vacío", "Vide", "Άδειο"],
  ["timetable.loadError", "No se pudo cargar el horario.", "Impossible de charger l'emploi du temps.", "Δεν ήταν δυνατή η φόρτωση του ωρολογίου."],
  ["timetable.noClasses", "Cree clases en Informes primero.", "Créez d'abord des classes dans Rapports.", "Δημιουργήστε πρώτα τάξεις στις Αναφορές."],
  ["timetable.noTeachers", "Invite profesores desde el panel primero.", "Invitez d'abord des enseignants depuis le tableau de bord.", "Προσκαλέστε πρώτα εκπαιδευτικούς από τον πίνακα ελέγχου."],
  ["timetable.teacherFromClassHint", "El profesor sale de la página de la clase.", "L'enseignant est défini sur la fiche classe.", "Ο εκπαιδευτικός ορίζεται στη σελίδα της τάξης."],
  ["timetable.assignTeacherOnClass", "Asigne un profesor en la ficha de clase antes de añadirla al horario.", "Assignez un enseignant sur la fiche classe avant l'ajouter.", "Αναθέστε εκπαιδευτικό στην κάρτα τάξης πριν από το ωρολόγιο."],
  ["timetable.pickClass", "Elija una clase.", "Choisissez une classe.", "Επιλέξτε τάξη."],
];

// Fix typo in teacherIntro FR - remove "deshyphens"
const filtered = [...entries];

// SaaS block — concise ES/FR/EL
const saasKeys = `
saas.platformBadge saas.ownerDashboardTitle saas.schoolDetailsTitle saas.backToOwner saas.creditPacksTitle saas.creditPacksLead saas.refreshPacks saas.thPack saas.thPriceCents saas.thCurrency saas.thCredits saas.thActive saas.thSortOrder saas.agentsTitle saas.agentsLead saas.refreshAgents saas.agentEmailLabel saas.displayNameLabel saas.placeholderAgentEmail saas.optionalPlaceholder saas.createAgentLink saas.thCode saas.thAgent saas.thCommissionPct saas.thPayoutWaitDays saas.thInactiveAfterDays saas.thLink saas.referralEarningsTitle saas.referralEarningsLead saas.refreshEarnings saas.agentEmailOptional saas.statusLabel saas.statusAll saas.statusPending saas.statusEligible saas.statusPaid saas.statusVoid saas.applyFilters saas.thTenant saas.thAmount saas.thCommission saas.thEligibleAt saas.changeStatus saas.promptSetStatus saas.noEarningsYet saas.openAiTitle saas.openAiLead saas.refreshOpenAi saas.clearErrors saas.rangeLabel saas.rangeDay saas.rangeWeek saas.rangeMonth saas.rangeYear saas.rangeYtd saas.rangeAll saas.openAiBillingLink saas.estimatedSpend saas.requestsCount saas.tokens saas.tokensPromptCompletion saas.byKind saas.kindDraft saas.kindTranslate saas.financeTitle saas.financeLead saas.vatEstimateTitle saas.vatEstimateSubtitle saas.vatYtd saas.vatSelectedPeriod saas.vatAllTime saas.vatRateBasis saas.vatBasisInclusive saas.vatBasisExclusive saas.vatOnRevenue saas.vatDisclaimer saas.vatStripeVsTaxTitle saas.vatStripeVsTaxBody saas.agentOptional saas.agentFilterPlaceholder saas.paidToSaaS saas.paidToAgents saas.paymentsCount saas.payoutsCount saas.searchSchoolsLabel saas.searchPlaceholder saas.searchHint saas.resultsCount saas.schoolsTitle saas.thTenantId saas.thOwners saas.viewSchool saas.exportExcel saas.noSearchResults saas.createdAt saas.referralCode saas.referredBy saas.membersTitle saas.roleOwner saas.roleDeptHead saas.roleTeacher saas.classesFirst500 saas.thName saas.thTeacher saas.thYear saas.thCefr saas.thId saas.thReports saas.studentsFirst200 saas.thClassId saas.reportsRecent50 saas.thUpdated saas.thReportAuthor saas.thTitle saas.thReportId
`.trim().split(/\s+/);

const saasTr = {
  es: "Plataforma|Panel SaaS|Detalles del centro|← Volver|Packs de créditos|Precios e informes por pack|Actualizar|Pack|Precio (céntimos)|Moneda|Créditos|Activo|Orden|Agentes|Enlaces y comisión|Actualizar agentes|Email agente|Nombre|agente@ejemplo.com|Opcional|Crear enlace|Código|Agente|Comisión %|Días espera pago|Inactivo tras (días)|Enlace|Comisiones|Pagos pendientes/eligibles|Actualizar|Email agente (opcional)|Estado|Todos|Pendiente|Elegible|Pagado|Anulado|Filtrar|Inquilino|Importe|Comisión|Elegible el|Cambiar estado|Estado: pending | eligible | paid | void|Sin ingresos aún|OpenAI|Uso y coste estimado|Actualizar OpenAI|Borrar errores|Rango|Día|Semana|Mes|Año|Ejercicio|Todo|Facturación OpenAI|Gasto estimado|{n} solicitudes|Tokens|prompt {prompt} • completion {completion}|Por tipo|Borrador: {req} req • {cost}|Traducción: {req} req • {cost}|Finanzas|Ingresos y pagos agentes|IVA estimado (interno)|Según ajustes del servidor|Año fiscal|Periodo|Todo el tiempo|{rate}% IVA • {basis}|Con IVA|Sin IVA (neto)|Sobre ingresos: {amount}|Orientativo; consulte asesor.|Stripe vs declaraciones|Stripe no sustituye sus obligaciones fiscales.|Agente (opcional)|email agente…|Pagado a SaaS|Pagado a agentes|{n} pagos|{n} pagos salida|Buscar escuelas / titulares|Palabra clave…|Resultados al escribir|{n} resultados|Escuelas|ID inquilino|Titulares|Ver escuela|Exportar Excel|Sin resultados.|Creado {datetime}|Código:|Referido por:|Miembros|Propietario|Jefe dept.|Profesor|Clases (500)|Nombre|Profesor|Año|MCER|ID|Informes|Alumnos (200)|ID clase|Informes recientes (50)|Actualizado|Autor|Título|ID informe".split("|"),
  fr: "Plateforme|Tableau SaaS|Détails école|← Retour|Packs crédits|Prix et rapports par pack|Actualiser|Pack|Prix (centimes)|Devise|Crédits|Actif|Ordre|Agents|Liens et commission|Actualiser agents|Email agent|Nom|agent@exemple.com|Optionnel|Créer lien|Code|Agent|Commission %|Délai paiement (j)|Inactif après (j)|Lien|Commissions|Voir commissions|Actualiser|Email agent (facultatif)|Statut|Tous|En attente|Éligible|Payé|Annulé|Filtrer|Client|Montant|Commission|Éligible le|Changer statut|Statut : pending | eligible | paid | void|Pas encore de revenus|OpenAI|Usage et coût estimé|Actualiser OpenAI|Effacer erreurs|Période|Jour|Semaine|Mois|Année|YTD|Tout|Facturation OpenAI|Dépense estimée|{n} requêtes|Jetons|prompt {prompt} • completion {completion}|Par type|Brouillon : {req} req • {cost}|Traduction : {req} req • {cost}|Finances|Encaissements et commissions|TVA estimée (interne)|Selon réglages serveur|Année fiscale|Période|Tout|{rate}% TVA • {basis}|TTC|HT (net)|Sur encaissements : {amount}|Indicatif ; consultez un expert.|Stripe vs déclarations|Stripe ne remplace pas vos obligations.|Agent (facultatif)|email agent…|Payé à SaaS|Payé aux agents|{n} paiements|{n} versements|Rechercher écoles / proprios|Mot-clé…|Résultats à la saisie|{n} résultats|Écoles|ID client|Proprios|Voir école|Exporter Excel|Aucun résultat.|Créé {datetime}|Code :|Parrainé par :|Membres|Propriétaire|Chef de dept.|Enseignant|Classes (500)|Nom|Enseignant|Année|CECRL|ID|Rapports|Élèves (200)|ID classe|Rapports récents (50)|Mis à jour|Auteur|Titre|ID rapport".split("|"),
  el: "Πλατφόρμα|Πίνακας SaaS|Λεπτομέρειες σχολείου|← Επιστροφή|Πακέτα πιστώσεων|Τιμές και αναφορές ανά πακέτο|Ανανέωση|Πακέτο|Τιμή (λεπτά)|Νόμισμα|Πιστώσεις|Ενεργό|Σειρά|Πράκτορες|Σύνδεσμοι και προμήθεια|Ανανέωση πρακτόρων|Email πράκτορα|Εμφανιζόμενο όνομα|agent@example.com|Προαιρετικό|Δημιουργία συνδέσμου|Κωδικός|Πράκτορας|Προμήθεια %|Αναμονή πληρωμής (ημ.)|Ανενεργό μετά (ημ.)|Σύνδεσμος|Προμήθειες συστάσεων|Προβολή/διαχείριση|Ανανέωση|Email πράκτορα (προαιρ.)|Κατάσταση|Όλα|Εκκρεμεί|Επιλέξιμο|Πληρωμένο|Ακυρωμένο|Εφαρμογή φίλτρων|Μισθωτής|Ποσό|Προμήθεια|Επιλέξιμο στις|Αλλαγή κατάστασης|Κατάσταση: pending | eligible | paid | void|Κανένα έσοδο ακόμη|OpenAI|Χρήση και εκτιμώμενο κόστος|Ανανέωση OpenAI|Διαγραφή σφαλμάτων|Εύρος|Ημέρα|Εβδομάδα|Μήνας|Έτος|YTD|Όλα|Τιμολόγηση OpenAI|Εκτιμώμενη δαπάνη|{n} αιτήσεις|Κουπόνια|prompt {prompt} • completion {completion}|Ανά είδος|Προσχέδιο: {req} αίτ. • {cost}|Μετάφραση: {req} αίτ. • {cost}|Οικονομικά|Εισπράξεις και προμήθειες|Εκτιμώμενο ΦΠΑ (εσωτ.)|Βάσει ρυθμίσεων διακομιστή|Οικ. έτος|Περίοδος|Όλο το διάστημα|{rate}% ΦΠΑ • {basis}|Με ΦΠΑ|Χωρίς ΦΠΑ (καθαρά)|Στις εισπράξεις: {amount}|Ενδεικτικό· συμβουλευτείτε λογιστή.|Stripe vs δηλώσεις|Το Stripe δεν αντικαθιστά τις φορολογικές υποχρεώσεις.|Πράκτορας (προαιρ.)|email πράκτορα…|Πληρωμές σε SaaS|Πληρωμές σε πράκτορες|{n} πληρωμές|{n} εκταμιεύσεις|Αναζήτηση σχολείων / ιδιοκτητών|Λέξη-κλειδί…|Αποτελέσματα κατά την πληκτρολόγηση|{n} αποτελέσματα|Σχολεία|ID μισθωτή|Ιδιοκτήτες|Προβολή σχολείου|Εξαγωγή Excel|Κανένα αποτέλεσμα.|Δημιουργήθηκε {datetime}|Κωδικός παραπομπαής:|Παραπέμφθηκε από:|Μέλη|Ιδιοκτήτης|Υπεύθ. τομέα|Εκπαιδευτικός|Τάξεις (500)|Όνομα|Εκπαιδευτικός|Έτος|CEFR|ID|Αναφορές|Μαθητές (200)|ID τάξης|Πρόσφατες αναφορές (50)|Ενημερώθηκε|Συντάκτης|Τίτλος|ID αναφοράς".split("|"),
};

for (let i = 0; i < saasKeys.length; i++) {
  const k = saasKeys[i];
  filtered.push([k, saasTr.es[i], saasTr.fr[i], saasTr.el[i]]);
}

function esc(s) {
  return JSON.stringify(s);
}

let es = "export const UI_FILL_ES: Record<string, string> = {\n";
let fr = "\nexport const UI_FILL_FR: Record<string, string> = {\n";
let el = "\nexport const UI_FILL_EL: Record<string, string> = {\n";

for (const [key, ves, vfr, vel] of filtered) {
  es += `  ${esc(key)}: ${esc(ves)},\n`;
  fr += `  ${esc(key)}: ${esc(vfr)},\n`;
  el += `  ${esc(key)}: ${esc(vel)},\n`;
}

const out = es + "};\n" + fr + "};\n" + el + "};\n";

const outPath = path.join(root, "src/lib/i18n/localeUiFill.ts");
fs.writeFileSync(outPath, out);
console.log("Wrote", outPath, "entries", filtered.length);
