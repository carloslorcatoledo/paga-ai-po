/*
 * app.js — Interfaz de "Paga aí po!".
 *
 * Toda la lógica de dinero vive en calc.js (probado). Este archivo solo maneja
 * la pantalla y el guardado local. Se carga como script externo (no en línea)
 * para poder aplicar una Content-Security-Policy estricta (ver index.html).
 *
 * Seguridad:
 *  - Todo texto del usuario se escapa con esc() antes de insertarlo en el DOM (anti-XSS).
 *  - Los datos se guardan solo en este dispositivo (localStorage). Nada se envía a
 *    ningún servidor; lo único que "sale" es el texto que tú mismo compartes por
 *    WhatsApp, y esa ventana se abre con 'noopener' y sin referer.
 */
(function () {
  'use strict';
  var R = window.Reparte;

  // ---------- Config ----------
  var CURRENCIES = {
    CLP: { code: 'CLP', decimals: 0, locale: 'es-CL', label: 'CLP', name: 'Peso chileno', sign: '$' },
    USD: { code: 'USD', decimals: 2, locale: 'en-US', label: 'USD', name: 'Dólar', sign: 'US$' },
    BRL: { code: 'BRL', decimals: 2, locale: 'pt-BR', label: 'BRL', name: 'Real brasileño', sign: 'R$' }
  };
  var TEXT = {
    es: {
      guestIntro: 'Puedes probar la app sin cuenta. Inicia sesión o crea una cuenta para guardar y abrir eventos en la nube.',
      cloudLoginRequired: 'Inicia sesión para usar esta función en la nube. Puedes seguir probando la app localmente.',
      profileRepairFailed: 'No se pudo crear o actualizar tu perfil. Comprueba que el esquema de Supabase esté actualizado y vuelve a intentarlo.',
      forgotPassword: 'Olvidé mi contraseña', resetEmailRequired: 'Escribe el correo de tu cuenta.', sendingResetLink: 'Enviando enlace…', resetLinkSent: 'Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña.', resetLinkFailed: 'No se pudo enviar el enlace. Intenta nuevamente.', resetHttpRequired: 'Abre la app desde su sitio web para solicitar el enlace.', resetTitle: 'Crear una contraseña nueva', resetIntro: 'Elige una contraseña nueva para tu cuenta.', newPasswordLabel: 'Nueva contraseña', newPasswordPlaceholder: 'Al menos 6 caracteres', updatePassword: 'Guardar contraseña nueva', cancelRecovery: 'Volver a entrar', passwordUpdated: 'Contraseña actualizada. Ya puedes entrar.', resetPasswordFailed: 'No se pudo actualizar la contraseña. Solicita un enlace nuevo.',
      languageLabel: 'Idioma', currencyLabel: 'Moneda', appDescription: 'Divide cuentas entre amigos por ítem y calcula cuánto debe pagar cada persona.', eventNamePlaceholder: 'Nombre del evento…', eventDate: 'Fecha del evento',
      peopleTab: 'Personas', expensesTab: 'Gastos', summaryTab: 'Resumen', calendarTab: 'Calendario', fabExpense: 'Gasto', peopleHeading: '¿Quiénes son?', personPlaceholder: 'Nombre…', addPerson: 'Agregar', removePerson: 'Quitar', peopleEmptyTitle: 'Agrega a quienes participan', peopleEmptyBody: 'Escribe un nombre arriba. Luego podrás crear gastos.',
      expensesHeading: 'Gastos', expensesEmptyTitle: 'Aún no hay gastos', addFirstExpense: 'Toca “＋ Gasto” para agregar el primero.', addPeopleFirst: 'Primero agrega personas, luego gastos.', summaryEmptyTitle: 'Nada que calcular todavía', summaryEmptyBody: 'Agrega gastos para ver quién debe a quién.', totalTitle: 'Total del evento', expenseCount: '{count} gasto(s)', peopleCount: '{count} persona(s)', subtotal: 'Subtotal', tip: 'Propina / servicio', noTip: 'Sin propina', otherTip: 'Otro %', balances: 'Saldo de cada uno', paid: 'Pagó', owes: 'le toca', receives: 'le deben', owesVerb: 'debe', upToDate: 'al día', settle: 'Cómo saldar (menos transferencias)', allSettled: 'Todos están al día ✓',
      shareWhatsApp: 'Compartir por WhatsApp', copy: 'Copiar', copied: '¡Copiado!', copyFailed: 'No se pudo copiar', shareHeading: 'Paga aí po! · Resumen', shareEvent: 'Evento', sharePeople: '{people} personas · {expenses} gastos', shareTotal: 'Total', shareTip: 'Incluye propina ({percent}%): {amount}', shareBalances: 'Saldo por persona', receive: 'Recibe', oweShare: 'Debe', shareTransfers: 'Transferencias sugeridas', paysTo: 'paga {amount} a', allSettledText: 'Todos están al día.', calculatedWith: 'Calculado con Paga aí po!',
      newExpense: 'Nuevo gasto', editExpense: 'Editar gasto', whatWasIt: '¿Qué fue?', amount: 'Monto', category: 'Categoría', whoPaid: '¿Quién pagó?', splitBetween: '¿Entre quiénes se divide?', all: 'Todos', none: 'Ninguno', includeTip: 'Incluir propina / servicio en este gasto', cancel: 'Cancelar', save: 'Guardar', delete: 'Eliminar gasto', amountError: 'Ingresa un monto mayor a 0.', payerError: 'Elige quién pagó.', splitError: 'Elige al menos una persona para dividir.',
      calendarTitle: 'Eventos guardados', previousMonth: 'Mes anterior', nextMonth: 'Mes siguiente', today: 'Hoy', monthDays: 'Días del mes', loading: 'Cargando…', loadingEvents: 'Cargando eventos…', noEventsToday: 'No hay eventos guardados para este día.', calendarAttendees: 'Asistentes', calendarOpenEvent: 'Abrir evento',
      options: 'Opciones', currencyHint: 'Al cambiar la moneda, los montos se reescalan; no se aplica tipo de cambio.', clearNew: 'Limpiar y crear evento', confirmNew: '¿Limpiar los datos ingresados y crear un evento nuevo? El evento actual se conservará en el historial.', loadExample: 'Cargar ejemplo', resetAll: 'Vaciar todo', confirmReset: 'Esto borra personas y gastos de este evento. ¿Continuar?', close: 'Cerrar',
      accountTitle: 'Cuenta / Nube', authIntro: 'Inicia sesión para continuar. Al crear una cuenta, registra tu nombre y correo para ver los eventos donde participas.', authName: 'Nombre (para crear cuenta)', namePlaceholder: 'Tu nombre', authEmail: 'Correo', emailPlaceholder: 'tu@correo.com', authPassword: 'Contraseña', passwordPlaceholder: 'mínimo 6 caracteres', expensePlaceholder: 'Pizza, cervezas, taxi…', enter: 'Entrar', createAccount: 'Crear cuenta', connectedAs: 'Conectado como', cloudSave: 'Guardar este evento en la nube', myEvents: 'Eventos en los que participo', cloudNew: 'Nuevo evento (vaciar)', joinLabel: 'Abrir un evento con código', join: 'Abrir', signOut: 'Cerrar sesión',
      nameRequired: 'Escribe tu nombre para crear la cuenta.', credentialsRequired: 'Escribe correo y contraseña.', passwordLength: 'La contraseña debe tener al menos 6 caracteres.', creatingAccount: 'Creando cuenta…', signingIn: 'Entrando…', accountCreated: '✓ ¡Cuenta creada!', confirmEmail: 'Cuenta creada. Confírmala desde tu correo, o apaga “Confirm email” en Supabase para entrar al instante.', sessionStarted: 'Sesión iniciada.', activityError: 'Sesión iniciada, pero no se registró la actividad. Aplica la migración SQL de Supabase.',
      categoryFood: 'Comida', categoryAlcohol: 'Alcohol', categoryDrinks: 'Bebidas', categoryTransport: 'Transporte', categoryOther: 'Otros',
      syncLocal: 'Hay cambios locales sin guardar. Recarga el evento para sincronizarlo.', syncConnected: 'Conectado en vivo', syncInterrupted: 'Conexión en vivo interrumpida', cloudUnavailable: 'La nube no está disponible. Se muestran los eventos guardados en este dispositivo.', loginForCloud: 'Inicia sesión para ver también los eventos de la nube. Los eventos locales seguirán visibles.', loginButton: 'Entrar a la nube', noCloudEvents: 'Aún no participas en eventos', noCloudEventsHint: 'Guarda un evento o ábrelo con su código para que aparezca aquí.', codeInvalid: 'Escribe un código.',
      eventCountAria: '{count} eventos', calendarLoginHint: 'Inicia sesión para ver y guardar eventos en el calendario.', reload: 'Recargar', weekdayMon: 'L', weekdayTue: 'M', weekdayWed: 'X', weekdayThu: 'J', weekdayFri: 'V', weekdaySat: 'S', weekdaySun: 'D',
      exampleEvent: 'Asado del viernes', exampleFood: 'Carne y pan', exampleBeer: 'Cervezas', exampleDrinks: 'Bebidas', themeToggle: 'Cambiar tema', menuLabel: 'Menú',
      among: 'entre', noTipSuffix: 'sin propina', expensePaidBy: 'Pagó {name} · entre {count}: {people}{noTip}',
      syncRemote: 'Hay cambios remotos; tus cambios sin guardar están protegidos.', syncChangedDuring: 'Cambiaste datos durante la sincronización; revisa antes de guardar.', syncReloadConfirm: '¿Descartar los cambios locales sin guardar y cargar la versión de la nube?', syncLoadFailed: 'No se pudo cargar la versión de la nube.', syncLoaded: 'Actualizado desde la nube',
      authUnavailable: 'La nube no está disponible (revisa tu conexión a internet).', authVerifyFailed: 'No se pudo verificar la sesión. Revisa tu conexión e inténtalo de nuevo.', signInFailed: 'No se pudo entrar: {error}', createFailed: 'No se pudo crear: {error}', generalError: 'Error: {error}',
      savedInCloud: 'Evento en la nube · código', saveCloudButton: 'Guardando…', savedCloud: 'Guardado y conectado en vivo', saveConflict: 'Hay cambios de otra persona. Recarga la versión de la nube antes de guardar.',
      noCode: 'Escribe un código.', searchingCode: 'Buscando…', codeSearchFailed: 'No se pudo: {error}', openFailed: 'No se pudo abrir: {error}',
      monthCount: '{count} eventos', dateSavedLocal: 'Guardado en este dispositivo', dateCode: 'Código {code}',
      removePersonConfirm: '¿Quitar a esta persona? También se eliminarán sus gastos asociados.', confirmDelete: '¿Eliminar este gasto?', newCloudConfirm: '¿Vaciar la pantalla para empezar un evento nuevo? Lo guardado en la nube no se borra.', calendarLoadFailed: 'No se pudo cargar el calendario: {error}', eventLoadFailed: 'No se pudo abrir: {error}', saveFailed: 'No se pudo guardar: {error}',
      categoryFood: 'Comida', categoryAlcohol: 'Alcohol', categoryDrinks: 'Bebidas', categoryTransport: 'Transporte', categoryOther: 'Otros'
    },
    pt: {
      guestIntro: 'Você pode testar o app sem conta. Entre ou crie uma conta para salvar e abrir eventos na nuvem.',
      cloudLoginRequired: 'Entre para usar esta função na nuvem. Você pode continuar testando o app localmente.',
      profileRepairFailed: 'Não foi possível criar ou atualizar seu perfil. Confira se o esquema do Supabase está atualizado e tente novamente.',
      forgotPassword: 'Esqueci minha senha', resetEmailRequired: 'Digite o e-mail da sua conta.', sendingResetLink: 'Enviando link…', resetLinkSent: 'Se houver uma conta com esse e-mail, você receberá um link para alterar a senha.', resetLinkFailed: 'Não foi possível enviar o link. Tente novamente.', resetHttpRequired: 'Abra o app pelo site para solicitar o link.', resetTitle: 'Criar uma nova senha', resetIntro: 'Escolha uma nova senha para sua conta.', newPasswordLabel: 'Nova senha', newPasswordPlaceholder: 'Pelo menos 6 caracteres', updatePassword: 'Salvar nova senha', cancelRecovery: 'Voltar para entrar', passwordUpdated: 'Senha atualizada. Você já pode entrar.', resetPasswordFailed: 'Não foi possível atualizar a senha. Solicite um novo link.',
      languageLabel: 'Idioma', currencyLabel: 'Moeda', appDescription: 'Divida a conta entre amigos por item e calcule quanto cada pessoa deve pagar.', eventNamePlaceholder: 'Nome do evento…', eventDate: 'Data do evento',
      peopleTab: 'Pessoas', expensesTab: 'Despesas', summaryTab: 'Resumo', calendarTab: 'Calendário', fabExpense: 'Despesa', peopleHeading: 'Quem participou?', personPlaceholder: 'Nome…', addPerson: 'Adicionar', removePerson: 'Remover', peopleEmptyTitle: 'Adicione quem saiu', peopleEmptyBody: 'Digite um nome acima. Depois, você poderá criar despesas.',
      expensesHeading: 'Despesas', expensesEmptyTitle: 'Ainda não há despesas', addFirstExpense: 'Toque em “＋ Despesa” para adicionar a primeira.', addPeopleFirst: 'Adicione pessoas primeiro e depois as despesas.', summaryEmptyTitle: 'Nada para calcular ainda', summaryEmptyBody: 'Adicione despesas para ver quem deve a quem.', totalTitle: 'Total do evento', expenseCount: '{count} despesa(s)', peopleCount: '{count} pessoa(s)', subtotal: 'Subtotal', tip: 'Gorjeta / serviço', noTip: 'Sem gorjeta', otherTip: 'Outra %', balances: 'Saldo de cada pessoa', paid: 'Pagou', owes: 'deve pagar', receives: 'tem a receber', owesVerb: 'deve', upToDate: 'em dia', settle: 'Como acertar (menos transferências)', allSettled: 'Todos estão em dia ✓',
      shareWhatsApp: 'Compartilhar no WhatsApp', copy: 'Copiar', copied: 'Copiado!', copyFailed: 'Não foi possível copiar', shareHeading: 'Paga aí po! · Resumo', shareEvent: 'Evento', sharePeople: '{people} pessoas · {expenses} despesas', shareTotal: 'Total', shareTip: 'Inclui gorjeta ({percent}%): {amount}', shareBalances: 'Saldo por pessoa', receive: 'Recebe', oweShare: 'Deve', shareTransfers: 'Transferências sugeridas', paysTo: 'paga {amount} para', allSettledText: 'Todos estão em dia.', calculatedWith: 'Calculado com Paga aí po!',
      newExpense: 'Nova despesa', editExpense: 'Editar despesa', whatWasIt: 'O que foi?', amount: 'Valor', category: 'Categoria', whoPaid: 'Quem pagou?', splitBetween: 'Entre quem será dividido?', all: 'Todos', none: 'Ninguém', includeTip: 'Incluir gorjeta / serviço nesta despesa', cancel: 'Cancelar', save: 'Salvar', delete: 'Excluir despesa', amountError: 'Digite um valor maior que 0.', payerError: 'Escolha quem pagou.', splitError: 'Escolha pelo menos uma pessoa para dividir.',
      calendarTitle: 'Eventos salvos', previousMonth: 'Mês anterior', nextMonth: 'Próximo mês', today: 'Hoje', monthDays: 'Dias do mês', loading: 'Carregando…', loadingEvents: 'Carregando eventos…', noEventsToday: 'Não há eventos salvos neste dia.', calendarAttendees: 'Participantes', calendarOpenEvent: 'Abrir evento',
      options: 'Opções', currencyHint: 'Ao trocar a moeda, os valores são reescalados; não há conversão cambial.', clearNew: 'Limpar e criar evento', confirmNew: 'Limpar os dados e criar um novo evento? O evento atual ficará salvo no histórico.', loadExample: 'Carregar exemplo', resetAll: 'Limpar tudo', confirmReset: 'Isso apaga pessoas e despesas deste evento. Continuar?', close: 'Fechar',
      accountTitle: 'Conta / Nuvem', authIntro: 'Entre para continuar. Ao criar uma conta, informe seu nome e e-mail para ver os eventos dos quais participa.', authName: 'Nome (para criar conta)', namePlaceholder: 'Seu nome', authEmail: 'E-mail', emailPlaceholder: 'voce@exemplo.com', authPassword: 'Senha', passwordPlaceholder: 'mínimo de 6 caracteres', expensePlaceholder: 'Pizza, cerveja, táxi…', enter: 'Entrar', createAccount: 'Criar conta', connectedAs: 'Conectado como', cloudSave: 'Salvar este evento na nuvem', myEvents: 'Eventos dos quais participo', cloudNew: 'Novo evento (limpar)', joinLabel: 'Abrir evento com código', join: 'Abrir', signOut: 'Sair da conta',
      nameRequired: 'Digite seu nome para criar a conta.', credentialsRequired: 'Digite e-mail e senha.', passwordLength: 'A senha deve ter pelo menos 6 caracteres.', creatingAccount: 'Criando conta…', signingIn: 'Entrando…', accountCreated: '✓ Conta criada!', confirmEmail: 'Conta criada. Confirme pelo e-mail ou desative “Confirm email” no Supabase para entrar agora.', sessionStarted: 'Sessão iniciada.', activityError: 'Sessão iniciada, mas a atividade não foi registrada. Aplique a migração SQL do Supabase.',
      categoryFood: 'Comida', categoryAlcohol: 'Álcool', categoryDrinks: 'Bebidas', categoryTransport: 'Transporte', categoryOther: 'Outros',
      syncLocal: 'Há alterações locais não salvas. Recarregue o evento para sincronizar.', syncConnected: 'Conectado ao vivo', syncInterrupted: 'Conexão ao vivo interrompida', cloudUnavailable: 'A nuvem está indisponível. Mostrando eventos salvos neste dispositivo.', loginForCloud: 'Entre para ver também os eventos da nuvem. Os eventos locais continuarão visíveis.', loginButton: 'Entrar na nuvem', noCloudEvents: 'Você ainda não participa de eventos', noCloudEventsHint: 'Salve um evento ou abra pelo código para vê-lo aqui.', codeInvalid: 'Digite um código.',
      eventCountAria: '{count} eventos', calendarLoginHint: 'Entre para ver e salvar eventos no calendário.', reload: 'Recarregar', weekdayMon: 'S', weekdayTue: 'T', weekdayWed: 'Q', weekdayThu: 'Q', weekdayFri: 'S', weekdaySat: 'S', weekdaySun: 'D',
      exampleEvent: 'Churrasco de sexta', exampleFood: 'Carne e pão', exampleBeer: 'Cervejas', exampleDrinks: 'Bebidas', themeToggle: 'Trocar tema', menuLabel: 'Menu',
      among: 'entre', noTipSuffix: 'sem gorjeta', expensePaidBy: 'Pagou {name} · entre {count}: {people}{noTip}',
      syncRemote: 'Há alterações remotas; suas alterações não salvas estão protegidas.', syncChangedDuring: 'Você alterou dados durante a sincronização; revise antes de salvar.', syncReloadConfirm: 'Descartar as alterações locais não salvas e carregar a versão da nuvem?', syncLoadFailed: 'Não foi possível carregar a versão da nuvem.', syncLoaded: 'Atualizado pela nuvem',
      authUnavailable: 'A nuvem está indisponível (verifique sua conexão com a internet).', authVerifyFailed: 'Não foi possível verificar a sessão. Verifique a conexão e tente novamente.', signInFailed: 'Não foi possível entrar: {error}', createFailed: 'Não foi possível criar: {error}', generalError: 'Erro: {error}',
      savedInCloud: 'Evento na nuvem · código', saveCloudButton: 'Salvando…', savedCloud: 'Salvo e conectado ao vivo', saveConflict: 'Outra pessoa fez alterações. Recarregue a versão da nuvem antes de salvar.',
      noCode: 'Digite um código.', searchingCode: 'Buscando…', codeSearchFailed: 'Não foi possível: {error}', openFailed: 'Não foi possível abrir: {error}',
      monthCount: '{count} eventos', dateSavedLocal: 'Salvo neste dispositivo', dateCode: 'Código {code}',
      removePersonConfirm: 'Remover esta pessoa? As despesas associadas a ela também serão removidas.', confirmDelete: 'Excluir esta despesa?', newCloudConfirm: 'Limpar a tela e começar um novo evento? O que está na nuvem não será apagado.', calendarLoadFailed: 'Não foi possível carregar o calendário: {error}', eventLoadFailed: 'Não foi possível abrir: {error}', saveFailed: 'Não foi possível salvar: {error}',
      categoryFood: 'Comida', categoryAlcohol: 'Álcool', categoryDrinks: 'Bebidas', categoryTransport: 'Transporte', categoryOther: 'Outros'
    },
    en: {
      guestIntro: 'Try the app without an account. Sign in or create an account to save and open cloud events.',
      cloudLoginRequired: 'Sign in to use this cloud feature. You can keep trying the app locally.',
      profileRepairFailed: 'Could not create or update your profile. Make sure the Supabase schema is up to date and try again.',
      forgotPassword: 'Forgot password?', resetEmailRequired: 'Enter your account email.', sendingResetLink: 'Sending link…', resetLinkSent: 'If an account exists for that email, you will receive a password reset link.', resetLinkFailed: 'Could not send the link. Try again.', resetHttpRequired: 'Open the app from its website to request a recovery link.', resetTitle: 'Create a new password', resetIntro: 'Choose a new password for your account.', newPasswordLabel: 'New password', newPasswordPlaceholder: 'At least 6 characters', updatePassword: 'Save new password', cancelRecovery: 'Back to sign in', passwordUpdated: 'Password updated. You can sign in now.', resetPasswordFailed: 'Could not update the password. Request a new link.',
      languageLabel: 'Language', currencyLabel: 'Currency', appDescription: 'Split bills by item with friends and calculate how much each person owes.', eventNamePlaceholder: 'Event name…', eventDate: 'Event date',
      peopleTab: 'People', expensesTab: 'Expenses', summaryTab: 'Summary', calendarTab: 'Calendar', fabExpense: 'Expense', peopleHeading: 'Who joined?', personPlaceholder: 'Name…', addPerson: 'Add', removePerson: 'Remove', peopleEmptyTitle: 'Add the people who joined', peopleEmptyBody: 'Enter a name above. Then you can add expenses.',
      expensesHeading: 'Expenses', expensesEmptyTitle: 'No expenses yet', addFirstExpense: 'Tap “＋ Expense” to add the first one.', addPeopleFirst: 'Add people first, then add expenses.', summaryEmptyTitle: 'Nothing to calculate yet', summaryEmptyBody: 'Add expenses to see who owes whom.', totalTitle: 'Event total', expenseCount: '{count} expense(s)', peopleCount: '{count} person(s)', subtotal: 'Subtotal', tip: 'Tip / service', noTip: 'No tip', otherTip: 'Other %', balances: 'Balances', paid: 'Paid', owes: 'owes', receives: 'is owed', owesVerb: 'owes', upToDate: 'settled', settle: 'Suggested settlement', allSettled: 'Everyone is settled ✓',
      shareWhatsApp: 'Share on WhatsApp', copy: 'Copy', copied: 'Copied!', copyFailed: 'Could not copy', shareHeading: 'Paga aí po! · Summary', shareEvent: 'Event', sharePeople: '{people} people · {expenses} expenses', shareTotal: 'Total', shareTip: 'Includes tip ({percent}%): {amount}', shareBalances: 'Balance by person', receive: 'Receives', oweShare: 'Owes', shareTransfers: 'Suggested transfers', paysTo: 'pays {amount} to', allSettledText: 'Everyone is settled.', calculatedWith: 'Calculated with Paga aí po!',
      newExpense: 'New expense', editExpense: 'Edit expense', whatWasIt: 'What was it?', amount: 'Amount', category: 'Category', whoPaid: 'Who paid?', splitBetween: 'Who shares this expense?', all: 'Everyone', none: 'No one', includeTip: 'Include tip / service for this expense', cancel: 'Cancel', save: 'Save', delete: 'Delete expense', amountError: 'Enter an amount greater than 0.', payerError: 'Choose who paid.', splitError: 'Choose at least one person to split this expense.',
      calendarTitle: 'Saved events', previousMonth: 'Previous month', nextMonth: 'Next month', today: 'Today', monthDays: 'Days of the month', loading: 'Loading…', loadingEvents: 'Loading events…', noEventsToday: 'No saved events on this day.', calendarAttendees: 'Attendees', calendarOpenEvent: 'Open event',
      options: 'Options', currencyHint: 'Changing currency rescales amounts; it does not apply an exchange rate.', clearNew: 'Clear and start a new event', confirmNew: 'Clear the entered data and start a new event? The current event will remain in history.', loadExample: 'Load example', resetAll: 'Clear all', confirmReset: 'This deletes people and expenses from this event. Continue?', close: 'Close',
      accountTitle: 'Account / Cloud', authIntro: 'Sign in to continue. When creating an account, enter your name and email to see events you participate in.', authName: 'Name (for new accounts)', namePlaceholder: 'Your name', authEmail: 'Email', emailPlaceholder: 'you@example.com', authPassword: 'Password', passwordPlaceholder: 'at least 6 characters', expensePlaceholder: 'Pizza, drinks, taxi…', enter: 'Sign in', createAccount: 'Create account', connectedAs: 'Signed in as', cloudSave: 'Save this event to the cloud', myEvents: 'Events I participate in', cloudNew: 'New event (clear)', joinLabel: 'Open an event with a code', join: 'Open', signOut: 'Sign out',
      nameRequired: 'Enter your name to create an account.', credentialsRequired: 'Enter your email and password.', passwordLength: 'Password must be at least 6 characters.', creatingAccount: 'Creating account…', signingIn: 'Signing in…', accountCreated: '✓ Account created!', confirmEmail: 'Account created. Confirm it by email, or turn off “Confirm email” in Supabase to sign in now.', sessionStarted: 'Signed in.', activityError: 'Signed in, but activity was not recorded. Apply the Supabase SQL migration.',
      categoryFood: 'Food', categoryAlcohol: 'Alcohol', categoryDrinks: 'Drinks', categoryTransport: 'Transport', categoryOther: 'Other',
      syncLocal: 'You have unsaved local changes. Reload the event to sync.', syncConnected: 'Live connection active', syncInterrupted: 'Live connection interrupted', cloudUnavailable: 'Cloud is unavailable. Showing events saved on this device.', loginForCloud: 'Sign in to also see cloud events. Local events will remain visible.', loginButton: 'Sign in to cloud', noCloudEvents: 'You are not in any events yet', noCloudEventsHint: 'Save an event or open it with a code to see it here.', codeInvalid: 'Enter a code.',
      eventCountAria: '{count} events', calendarLoginHint: 'Sign in to view and save calendar events.', reload: 'Reload', weekdayMon: 'M', weekdayTue: 'T', weekdayWed: 'W', weekdayThu: 'T', weekdayFri: 'F', weekdaySat: 'S', weekdaySun: 'S',
      exampleEvent: 'Friday barbecue', exampleFood: 'Meat and bread', exampleBeer: 'Beer', exampleDrinks: 'Drinks', themeToggle: 'Change theme', menuLabel: 'Menu',
      among: 'among', noTipSuffix: 'no tip', expensePaidBy: 'Paid by {name} · split among {count}: {people}{noTip}',
      syncRemote: 'There are remote changes; your unsaved changes are protected.', syncChangedDuring: 'You changed data during sync; review before saving.', syncReloadConfirm: 'Discard unsaved local changes and load the cloud version?', syncLoadFailed: 'Could not load the cloud version.', syncLoaded: 'Updated from cloud',
      authUnavailable: 'Cloud is unavailable (check your internet connection).', authVerifyFailed: 'Could not verify the session. Check your connection and try again.', signInFailed: 'Could not sign in: {error}', createFailed: 'Could not create account: {error}', generalError: 'Error: {error}',
      savedInCloud: 'Cloud event · code', saveCloudButton: 'Saving…', savedCloud: 'Saved and live connection active', saveConflict: 'Someone else made changes. Reload the cloud version before saving.',
      noCode: 'Enter a code.', searchingCode: 'Searching…', codeSearchFailed: 'Could not join: {error}', openFailed: 'Could not open: {error}',
      monthCount: '{count} events', dateSavedLocal: 'Saved on this device', dateCode: 'Code {code}',
      removePersonConfirm: 'Remove this person? Their associated expenses will also be removed.', confirmDelete: 'Delete this expense?', newCloudConfirm: 'Clear the screen and start a new event? Saved cloud events will not be deleted.', calendarLoadFailed: 'Could not load calendar: {error}', eventLoadFailed: 'Could not open: {error}', saveFailed: 'Could not save: {error}',
      categoryFood: 'Food', categoryAlcohol: 'Alcohol', categoryDrinks: 'Drinks', categoryTransport: 'Transport', categoryOther: 'Other'
    }
  };
  Object.assign(TEXT.es, {
    paymentUnpaid: 'Pendiente', paymentPartial: 'Pago parcial', paymentPaid: 'Pagado',
    paymentAmountLabel: 'Abonado', paymentRemaining: 'Restante', paymentSave: 'Guardar monto',
    paymentMarkPaid: 'Marcar como pagado', paymentMarkUnpaid: 'Marcar como pendiente',
    paymentAmountInvalid: 'El monto debe estar entre 0 y {amount}.',
    paymentSaveEventFirst: 'Guarda los cambios del evento antes de actualizar pagos.',
    paymentSaveFailed: 'No se pudo actualizar el pago: {error}',
      paymentSchemaMissing: 'Aplica el esquema actualizado de Supabase para activar el seguimiento de pagos.',
    paymentStale: 'Cambió el evento. Recarga su versión actual antes de modificar pagos.',
    trialActive: 'Prueba gratuita: {days} días restantes para guardar en la nube.',
    trialPaid: 'Acceso cloud activo hasta {date}.',
    trialExpired: 'Tu prueba terminó. Puedes seguir usando los datos locales y consultar eventos guardados. Contáctanos para conocer el precio y reactivar la nube.',
    trialVerifying: 'Verificando tu acceso a la nube…',
    trialUnavailable: 'No se pudo verificar tu acceso cloud. Aplica el esquema actualizado de Supabase.'
  });
  Object.assign(TEXT.pt, {
    peopleEmptyTitle: 'Adicione quem participou',
    paymentUnpaid: 'Pendente', paymentPartial: 'Pagamento parcial', paymentPaid: 'Pago',
    paymentAmountLabel: 'Pago', paymentRemaining: 'Restante', paymentSave: 'Salvar valor',
    paymentMarkPaid: 'Marcar como pago', paymentMarkUnpaid: 'Marcar como pendente',
    paymentAmountInvalid: 'O valor deve estar entre 0 e {amount}.',
    paymentSaveEventFirst: 'Salve as alterações do evento antes de atualizar pagamentos.',
    paymentSaveFailed: 'Não foi possível atualizar o pagamento: {error}',
    paymentSchemaMissing: 'Aplique o esquema atualizado do Supabase para ativar o controle de pagamentos.',
    paymentStale: 'O evento mudou. Recarregue a versão atual antes de alterar pagamentos.',
    trialActive: 'Período gratuito: faltam {days} dias para salvar na nuvem.',
    trialPaid: 'Acesso à nuvem ativo até {date}.',
    trialExpired: 'Seu período gratuito terminou. Você pode continuar usando os dados locais e consultar eventos salvos. Entre em contato para saber o preço e reativar a nuvem.',
    trialVerifying: 'Verificando seu acesso à nuvem…',
    trialUnavailable: 'Não foi possível verificar seu acesso à nuvem. Aplique o esquema atualizado do Supabase.'
  });
  Object.assign(TEXT.en, {
    paymentUnpaid: 'Unpaid', paymentPartial: 'Partially paid', paymentPaid: 'Paid',
    paymentAmountLabel: 'Paid', paymentRemaining: 'Remaining', paymentSave: 'Save amount',
    paymentMarkPaid: 'Mark as paid', paymentMarkUnpaid: 'Mark as unpaid',
    paymentAmountInvalid: 'Amount must be between 0 and {amount}.',
    paymentSaveEventFirst: 'Save event changes before updating payments.',
    paymentSaveFailed: 'Could not update payment: {error}',
    paymentSchemaMissing: 'Apply the updated Supabase schema to enable payment tracking.',
    paymentStale: 'The event changed. Reload its latest version before updating payments.',
    trialActive: 'Free trial: {days} days left to save to the cloud.',
    trialPaid: 'Cloud access is active until {date}.',
    trialExpired: 'Your trial has ended. You can keep using local data and view saved events. Contact us for pricing and to restore cloud access.',
    trialVerifying: 'Checking your cloud access…',
    trialUnavailable: 'Could not verify cloud access. Apply the updated Supabase schema.'
  });
  var CATEGORIES = [
    { id: 'comida', label: 'Comida', key: 'categoryFood', icon: '🍕' },
    { id: 'alcohol', label: 'Alcohol', key: 'categoryAlcohol', icon: '🍺' },
    { id: 'bebidas', label: 'Bebidas', key: 'categoryDrinks', icon: '🥤' },
    { id: 'transporte', label: 'Transporte', key: 'categoryTransport', icon: '🚕' },
    { id: 'otros', label: 'Otros', key: 'categoryOther', icon: '🧾' }
  ];
  var AVATAR_COLORS = ['#ef4444','#f97316','#f59e0b','#10b981','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#ec4899','#14b8a6'];
  var STORAGE_KEY = 'pagaaipo_v1';
  var HISTORY_KEY = 'pagaaipo_history_v1';
  var MAX_HISTORY_ITEMS = 100;

  // ---------- State ----------
  var state = {
    eventName: '', eventDate: localDate(new Date()), currency: 'BRL', language: 'es', theme: 'system', tab: 'personas',
    tipPercent: 0, participants: [], expenses: [],
    cloudId: null, cloudVersion: null, cloudBaseline: null, cloudOwnerId: null, financialFingerprint: null,
    paymentSchemaAvailable: false, transferPayments: {}, codigo: null, historyId: null
  };
  var TIP_PRESETS = [0, 5, 10, 15];
  var editingId = null;
  var calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  var calendarSelectedDate = localDate(new Date());
  var calendarEvents = [];
  var calendarDetailId = null;
  var calendarDetail = null;
  var calendarDetailLoading = false;
  var calendarDetailError = '';
  var calendarDetailRequest = 0;
  var localHistory = [];
  var calendarLoading = false;
  var calendarMessage = '';
  var calendarRequest = 0;
  var syncBaseline = null;
  var liveRefreshTimer = null;
  var cloudSaveInProgress = false;
  var remoteConflict = false;
  var currentSession = null;
  var profileReady = false;
  var cloudAccess = null;
  var cloudAccessReady = false;
  var cloudAccessError = null;
  var passwordRecoveryMode = false;

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    saveLocalHistorySnapshot();
  }
  function loadLocalHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      var rows = raw ? JSON.parse(raw) : [];
      localHistory = Array.isArray(rows) ? rows.filter(function (row) {
        return row && typeof row.historyId === 'string' && validDate(row.eventDate);
      }) : [];
    } catch (e) { localHistory = []; }
  }
  function saveLocalHistorySnapshot() {
    if (!state.historyId) state.historyId = uid();
    if (!state.eventName.trim() && !state.participants.length && !state.expenses.length) return;
    var snapshot;
    try { snapshot = JSON.parse(eventSnapshot()); } catch (e) { return; }
    var record = Object.assign(snapshot, {
      historyId: state.historyId,
      cloudId: state.cloudId,
      cloudVersion: state.cloudVersion,
      cloudBaseline: state.cloudBaseline,
      codigo: state.codigo,
      updatedAt: new Date().toISOString()
    });
    var existing = localHistory.findIndex(function (item) {
      return item.historyId === record.historyId || (record.cloudId && item.cloudId === record.cloudId);
    });
    if (existing !== -1) {
      record.historyId = localHistory[existing].historyId;
      localHistory.splice(existing, 1);
    }
    localHistory.unshift(record);
    localHistory = localHistory.slice(0, MAX_HISTORY_ITEMS);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(localHistory)); } catch (e) {}
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        state.eventName = typeof s.eventName === 'string' ? s.eventName : '';
        state.eventDate = validDate(s.eventDate) ? s.eventDate : localDate(new Date());
        state.currency = CURRENCIES[s.currency] ? s.currency : 'BRL';
        state.language = TEXT[s.language] ? s.language : 'es';
        state.theme = s.theme || 'system';
        state.tab = s.tab || 'personas';
        state.tipPercent = (typeof s.tipPercent === 'number' && s.tipPercent >= 0) ? s.tipPercent : 0;
        state.participants = Array.isArray(s.participants) ? s.participants : [];
        state.expenses = Array.isArray(s.expenses) ? s.expenses : [];
        state.cloudId = s.cloudId || null;
        state.cloudVersion = Number.isInteger(s.cloudVersion) ? s.cloudVersion : null;
        state.cloudBaseline = typeof s.cloudBaseline === 'string' ? s.cloudBaseline : null;
        state.cloudOwnerId = typeof s.cloudOwnerId === 'string' ? s.cloudOwnerId : null;
        state.financialFingerprint = typeof s.financialFingerprint === 'string' ? s.financialFingerprint : null;
        state.paymentSchemaAvailable = s.paymentSchemaAvailable === true;
        state.transferPayments = s.transferPayments && typeof s.transferPayments === 'object' ? s.transferPayments : {};
        state.codigo = s.codigo || null;
        state.historyId = typeof s.historyId === 'string' ? s.historyId : uid();
      }
    } catch (e) {}
    if (!state.historyId) state.historyId = uid();
  }

  // ---------- Helpers ----------
  function $(id) { return document.getElementById(id); }
  function t(key, values) {
    var text = (TEXT[state.language] && TEXT[state.language][key]) || TEXT.es[key] || key;
    return text.replace(/\{(\w+)\}/g, function (_, name) {
      return values && values[name] != null ? values[name] : '';
    });
  }
  function applyStaticTranslations() {
    document.documentElement.lang = state.language;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) { el.placeholder = t(el.dataset.i18nPlaceholder); });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.title = t(el.dataset.i18nTitle);
      if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', t(el.dataset.i18nTitle));
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function localDate(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function locale() { return { es: 'es-CL', pt: 'pt-BR', en: 'en-US' }[state.language] || 'es-CL'; }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var parts = value.split('-').map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2];
  }
  function eventSnapshot() {
    return JSON.stringify({
      eventName: state.eventName, eventDate: state.eventDate, currency: state.currency,
      tipPercent: state.tipPercent, participants: state.participants, expenses: state.expenses
    });
  }
  function transferPaymentKey(payerKey, receiverKey) { return JSON.stringify([payerKey, receiverKey]); }
  function resetCloudPaymentState() {
    state.cloudOwnerId = null; state.financialFingerprint = null;
    state.paymentSchemaAvailable = false; state.transferPayments = {};
  }
  function setSyncStatus(message, conflict, canReload) {
    var box = $('syncStatus');
    box.hidden = !message;
    box.classList.toggle('conflict', !!conflict);
    $('syncStatusText').textContent = message;
    $('syncReload').hidden = !canReload;
  }
  function stopCloudSync() {
    if (liveRefreshTimer) clearTimeout(liveRefreshTimer);
    liveRefreshTimer = null; syncBaseline = null; remoteConflict = false;
    if (window.Cloud && window.Cloud.unsubscribeEvent) window.Cloud.unsubscribeEvent();
    setSyncStatus('', false);
  }
  function startCloudSync() {
    if (!currentSession || !profileReady || !state.cloudId) return;
    syncBaseline = state.cloudBaseline;
    remoteConflict = !syncBaseline || eventSnapshot() !== syncBaseline;
    if (remoteConflict) setSyncStatus(t('syncLocal'), true, true);
    subscribeCurrentEvent();
  }
  function subscribeCurrentEvent() {
    if (!cloudReady() || !currentSession || !profileReady || !state.cloudId || !window.Cloud.subscribeEvent) return;
    window.Cloud.subscribeEvent(state.cloudId, function () {
      if (liveRefreshTimer) clearTimeout(liveRefreshTimer);
      liveRefreshTimer = setTimeout(refreshFromCloud, 1200);
    }, function (status) {
      if (remoteConflict) return;
      if (status === 'SUBSCRIBED') setSyncStatus(t('syncConnected'), false);
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSyncStatus(t('syncInterrupted'), true, true);
    }, state.paymentSchemaAvailable);
  }
  function refreshFromCloud() {
    if (!currentSession || !profileReady || !state.cloudId) return;
    if (cloudSaveInProgress) { liveRefreshTimer = setTimeout(refreshFromCloud, 500); return; }
    var id = state.cloudId;
    var before = eventSnapshot();
    if (syncBaseline === null || before !== syncBaseline) {
      remoteConflict = true;
      setSyncStatus(t('syncRemote'), true, true);
      return;
    }
    window.Cloud.loadEvent(id).then(function (res) {
      if (state.cloudId !== id) return;
      if (eventSnapshot() !== before) {
        remoteConflict = true;
        setSyncStatus(t('syncChangedDuring'), true, true);
        return;
      }
      if (res.error) { setSyncStatus(t('syncLoadFailed'), true, true); return; }
      applyLoadedEvent(res.data);
      setSyncStatus(t('syncConnected'), false);
    }).catch(function () { setSyncStatus(t('syncLoadFailed'), true, true); });
  }
  function reloadCurrentEvent() {
    if (!currentSession || !profileReady || !state.cloudId || !window.Cloud) return;
    if (!confirm(t('syncReloadConfirm'))) return;
    var id = state.cloudId;
    window.Cloud.loadEvent(id).then(function (res) {
      if (res.error) { setSyncStatus(t('syncLoadFailed'), true, true); return; }
      applyLoadedEvent(res.data);
      setSyncStatus(t('syncLoaded'), false);
    }).catch(function () { setSyncStatus(t('syncLoadFailed'), true, true); });
  }
  function cur() { return CURRENCIES[state.currency] || CURRENCIES.BRL; }
  function factor() { return Math.pow(10, cur().decimals); }
  function fmt(minor) {
    var c = cur();
    try {
      return new Intl.NumberFormat(locale(), {
        style: 'currency', currency: c.code,
        minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals
      }).format((minor || 0) / factor());
    } catch (e) { return c.sign + (minor || 0); }
  }
  function fmtForCurrency(minor, currency) {
    var c = CURRENCIES[currency] || CURRENCIES.BRL;
    try {
      return new Intl.NumberFormat(locale(), {
        style: 'currency', currency: c.code,
        minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals
      }).format((minor || 0) / Math.pow(10, c.decimals));
    } catch (e) { return c.sign + (minor || 0); }
  }
  function parseAmount(str) {
    if (str == null) return 0;
    var n = parseFloat(String(str).replace(',', '.'));
    if (!isFinite(n) || n < 0) return 0;
    return Math.round(n * factor());
  }
  function initials(name) {
    var parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  function pById(id) { for (var i = 0; i < state.participants.length; i++) if (state.participants[i].id === id) return state.participants[i]; return null; }
  function nameOf(id) { var p = pById(id); return p ? p.name : '—'; }
  function colorOf(id) { var p = pById(id); return p ? p.color : '#888'; }
  function catOf(id) { for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i]; return CATEGORIES[4]; }
  function catLabel(category) { return t(category.key); }
  // Anti-XSS: escapa texto antes de insertarlo como HTML.
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]; }); }

  // ---------- Render ----------
  function render() {
    applyStaticTranslations();
    $('eventName').value = state.eventName;
    $('eventDate').value = state.eventDate || localDate(new Date());
    $('currencyHeader').value = state.currency;
    $('languageHeader').value = state.language;
    $('badgePeople').textContent = state.participants.length;
    $('badgeExp').textContent = state.expenses.length;
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === state.tab); });
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + state.tab); });
    $('fab').style.display = state.tab === 'gastos' ? 'inline-flex' : 'none';
    $('themeBtn').textContent = state.theme === 'dark' ? '☀️' : (state.theme === 'light' ? '🌙' : '🌓');
    updateCloudTrialUI();
    renderPeople();
    renderExpenses();
    if (state.tab === 'resumen') renderSummary();
    if (state.tab === 'calendario') renderCalendar();
  }

  function renderPeople() {
    var box = $('peopleList');
    if (!state.participants.length) {
      box.innerHTML = emptyHTML('👋', t('peopleEmptyTitle'), t('peopleEmptyBody'));
      return;
    }
    box.innerHTML = state.participants.map(function (p) {
      return '<div class="person-chip">' +
        '<div class="avatar" style="background:' + esc(p.color) + '">' + esc(initials(p.name)) + '</div>' +
        '<div class="pname">' + esc(p.name) + '</div>' +
        '<button class="remove-x" data-remove="' + esc(p.id) + '" aria-label="Quitar">×</button>' +
        '</div>';
    }).join('');
  }

  function renderExpenses() {
    var box = $('expList');
    if (!state.expenses.length) {
      box.innerHTML = emptyHTML('🧾', t('expensesEmptyTitle'),
        state.participants.length ? t('addFirstExpense') : t('addPeopleFirst'));
      return;
    }
    box.innerHTML = state.expenses.map(function (e) {
      var names = e.participants.map(nameOf);
      var noTip = (state.tipPercent > 0 && e.tip === false) ? ' · ' + t('noTipSuffix') : '';
      var sub = t('expensePaidBy', { name: esc(nameOf(e.paidBy)), count: e.participants.length, people: esc(names.join(', ')), noTip: noTip });
      return '<div class="exp-card" data-edit="' + esc(e.id) + '">' +
        '<div class="exp-icon">' + catOf(e.category).icon + '</div>' +
        '<div class="exp-main">' +
          '<div class="exp-top"><span class="exp-desc">' + esc(e.description || catLabel(catOf(e.category))) + '</span>' +
          '<span class="exp-amt">' + esc(fmt(e.amount)) + '</span></div>' +
          '<div class="exp-sub">' + sub + '</div>' +
        '</div></div>';
    }).join('');
  }

  function setTip(p) {
    state.tipPercent = (isFinite(p) && p >= 0) ? Math.min(p, 1000) : 0;
    save(); renderSummary();
  }

  function renderTransferPayment(transfer) {
    var key = transferPaymentKey(transfer.from, transfer.to);
    var saved = state.transferPayments[key];
    var paid = saved && Number(saved.monto_deuda) === transfer.amount ? Number(saved.monto_pagado) || 0 : 0;
    paid = Math.max(0, Math.min(transfer.amount, paid));
    var remaining = transfer.amount - paid;
    var status = paid === 0 ? 'payment-unpaid' : remaining === 0 ? 'payment-paid' : 'payment-partial';
    var statusText = paid === 0 ? t('paymentUnpaid') : remaining === 0 ? t('paymentPaid') : t('paymentPartial');
    var trackPayments = !!state.cloudId && state.paymentSchemaAvailable;
    var html = '<div class="transfer-payment-row"><div class="transfer"><span class="t-name">' + esc(transfer.fromName) + '</span>' +
      '<span class="t-mid">→ <span class="t-amt">' + esc(fmt(transfer.amount)) + '</span> →</span>' +
      '<span class="t-name">' + esc(transfer.toName) + '</span></div>';
    if (trackPayments) {
      html += '<div class="transfer-payment-status"><strong class="' + status + '">' + statusText + '</strong><span>' +
        t('paymentAmountLabel') + ': ' + esc(fmt(paid)) + ' · ' + t('paymentRemaining') + ': ' + esc(fmt(remaining)) + '</span></div>';
    }
    if (paymentsEditable()) {
      var inputValue = (paid / factor()).toFixed(cur().decimals);
      var step = cur().decimals ? '0.01' : '1';
      html += '<form class="transfer-payment-controls" data-transfer-payment-form data-payer-key="' + esc(transfer.from) + '" data-receiver-key="' + esc(transfer.to) + '" data-due-amount="' + transfer.amount + '">' +
        '<button type="button" class="icon-btn payment-action" data-payment-action="paid" aria-label="' + esc(t('paymentMarkPaid')) + '" title="' + esc(t('paymentMarkPaid')) + '">✓</button>' +
        '<button type="button" class="icon-btn payment-action" data-payment-action="unpaid" aria-label="' + esc(t('paymentMarkUnpaid')) + '" title="' + esc(t('paymentMarkUnpaid')) + '">×</button>' +
        '<label class="payment-input-label">' + t('paymentAmountLabel') + '<input class="text-input payment-amount" type="number" inputmode="decimal" min="0" max="' + (transfer.amount / factor()) + '" step="' + step + '" value="' + inputValue + '" aria-label="' + esc(t('paymentAmountLabel')) + '" /></label>' +
        '<button type="submit" class="btn btn-ghost btn-sm">' + t('paymentSave') + '</button><span class="payment-feedback" data-payment-feedback role="status"></span></form>';
    } else if (isCloudOwner() && state.paymentSchemaAvailable) {
      html += '<div class="hint payment-editor-hint">' + esc(t('paymentSaveEventFirst')) + '</div>';
    }
    return html + '</div>';
  }

  function paymentsEditable() {
    return canWriteCloud() && isCloudOwner() && state.paymentSchemaAvailable && !remoteConflict &&
      !!state.cloudBaseline && eventSnapshot() === state.cloudBaseline;
  }

  function calendarSaveText(key) {
    var translations = {
      es: { save: 'Guardar en calendario', progress: 'Guardando en calendario…', success: 'Evento guardado. Ya aparece en Calendario.' },
      pt: { save: 'Salvar no calendário', progress: 'Salvando no calendário…', success: 'Evento salvo. Ele já aparece no Calendário.' },
      en: { save: 'Save to calendar', progress: 'Saving to calendar…', success: 'Event saved. It now appears in Calendar.' }
    };
    var language = translations[state.language] ? state.language : 'es';
    return translations[language][key];
  }

  function renderSummary() {
    var box = $('summaryContent');
    if (!state.expenses.length) {
      box.innerHTML = emptyHTML('📊', t('summaryEmptyTitle'), t('summaryEmptyBody'));
      return;
    }
    var tip = state.tipPercent || 0;
    var balances = R.computeBalances(state.participants, state.expenses, { tipPercent: tip });
    var totals = R.eventTotals(state.expenses, tip);
    var sorted = balances.slice().sort(function (a, b) { return b.balance - a.balance; });

    var html = '';
    html += '<div class="total-card"><div class="lbl">' + t('totalTitle') + '</div>' +
      '<div class="amt">' + esc(fmt(totals.total)) + '</div>' +
      '<div class="meta">' + t('expenseCount', { count: state.expenses.length }) + ' · ' + t('peopleCount', { count: state.participants.length }) + '</div>' +
      (tip > 0 ? '<div class="sub">' + t('subtotal') + ' ' + esc(fmt(totals.subtotal)) + '  +  ' + t('tip') + ' ' + esc(fmt(totals.tip)) + ' (' + tip + '%)</div>' : '') +
      '</div>';

    // Propina / servicio
    html += '<div class="tip-card"><div class="tip-head"><span class="lbl">' + t('tip') + '</span>' +
      '<span class="amt">' + (tip > 0 ? esc(fmt(totals.tip)) : t('noTip')) + '</span></div>' +
      '<div class="chips" id="tipChips">' +
        TIP_PRESETS.map(function (p) {
          return '<button type="button" class="chip' + (p === tip ? ' active' : '') + '" data-tip="' + p + '">' + (p === 0 ? t('noTip') : p + '%') + '</button>';
        }).join('') +
        '<input class="text-input tip-custom" id="tipCustom" type="number" inputmode="decimal" min="0" max="100" step="0.5" placeholder="' + t('otherTip') + '" value="' + (TIP_PRESETS.indexOf(tip) === -1 ? tip : '') + '" />' +
      '</div></div>';

    html += '<div class="section-title">' + t('balances') + '</div>';
    html += sorted.map(function (b) {
      var pill, label, amt;
      if (b.balance > 0) { pill = 'pill-pos'; label = t('receives'); amt = '+' + fmt(b.balance); }
      else if (b.balance < 0) { pill = 'pill-neg'; label = t('owesVerb'); amt = '−' + fmt(-b.balance); }
      else { pill = 'pill-zero'; label = t('upToDate'); amt = fmt(0); }
      return '<div class="person-card">' +
        '<div class="avatar" style="background:' + esc(colorOf(b.id)) + '">' + esc(initials(b.name)) + '</div>' +
        '<div class="pc-main"><div class="pc-name">' + esc(b.name) + '</div>' +
        '<div class="pc-sub">' + t('paid') + ' ' + esc(fmt(b.paid)) + ' · ' + t('owes') + ' ' + esc(fmt(b.owes)) + '</div></div>' +
        '<div class="pill ' + pill + '">' + esc(amt) + '<small>' + label + '</small></div></div>';
    }).join('');

    var transfers = R.simplifyDebts(balances);
    if (!transfers.length) {
      html += '<div class="settle-card" style="text-align:center;color:var(--muted)">' + t('allSettled') + '</div>';
    } else {
      html += '<div class="settle-card">' + transfers.map(renderTransferPayment).join('') + '</div>';
    }
    if (state.cloudId && !state.paymentSchemaAvailable) html += '<div class="hint payment-schema-hint">' + esc(t('paymentSchemaMissing')) + '</div>';

    html += '<div class="summary-calendar-save"><button class="btn btn-primary btn-block" id="saveCalendar" type="button">' + calendarSaveText('save') + '</button>' +
      '<div class="hint" id="calendarSaveFeedback" role="status" aria-live="polite" hidden></div></div>';

    html += '<div class="share-row">' +
      '<button class="btn btn-wa" id="shareWa" style="flex:2">📲 ' + t('shareWhatsApp') + '</button>' +
      '<button class="btn btn-ghost" id="copySum" style="flex:1">' + t('copy') + '</button></div>';

    box.innerHTML = html;
    $('tipChips').addEventListener('click', function (e) {
      var c = e.target.closest('[data-tip]'); if (c) setTip(parseFloat(c.dataset.tip));
    });
    $('tipCustom').addEventListener('change', function () { setTip(parseFloat(this.value)); });
    $('shareWa').addEventListener('click', shareWhatsApp);
    $('copySum').addEventListener('click', copySummary);
  }

  function saveTransferPayment(payerKey, receiverKey, dueAmount, paidAmount, form) {
    var feedback = form.querySelector('[data-payment-feedback]');
    var eventId = state.cloudId;
    var fingerprint = state.financialFingerprint;
    if (!paymentsEditable() || !fingerprint || !Number.isSafeInteger(dueAmount) || dueAmount <= 0 ||
      !Number.isSafeInteger(paidAmount) || paidAmount < 0 || paidAmount > dueAmount) {
      feedback.textContent = t('paymentAmountInvalid', { amount: fmt(dueAmount) });
      return;
    }
    form.querySelectorAll('button, input').forEach(function (control) { control.disabled = true; });
    window.Cloud.updateTransferPayment({
      eventId: eventId, payerKey: payerKey, receiverKey: receiverKey,
      dueAmount: dueAmount, paidAmount: paidAmount, financialFingerprint: fingerprint
    }).then(function (res) {
      if (state.cloudId !== eventId || state.financialFingerprint !== fingerprint) return;
      if (res.error) {
        if (isTrialExpiredError(res.error)) {
          showTrialExpired();
          feedback.textContent = t('trialExpired');
          form.querySelectorAll('button, input').forEach(function (control) { control.disabled = false; });
          return;
        }
        if (res.error.message.indexOf('PAYMENT_EVENT_CHANGED') !== -1 || res.error.code === '40001') {
          setSyncStatus(t('paymentStale'), true, true);
          feedback.textContent = t('paymentStale');
        } else feedback.textContent = t('paymentSaveFailed', { error: res.error.message });
        form.querySelectorAll('button, input').forEach(function (control) { control.disabled = false; });
        return;
      }
      var key = transferPaymentKey(payerKey, receiverKey);
      if (paidAmount === 0) delete state.transferPayments[key];
      else state.transferPayments[key] = {
        pagador_key: payerKey, receptor_key: receiverKey,
        monto_deuda: dueAmount, monto_pagado: paidAmount,
        financial_fingerprint: fingerprint, updated_at: new Date().toISOString()
      };
      save(); renderSummary();
    }).catch(function (error) {
      if (state.cloudId === eventId) feedback.textContent = t('paymentSaveFailed', { error: error.message });
      form.querySelectorAll('button, input').forEach(function (control) { control.disabled = false; });
    });
  }

  function emptyHTML(icon, title, text) {
    return '<div class="empty"><div class="big">' + icon + '</div><strong>' + esc(title) + '</strong><p>' + esc(text) + '</p></div>';
  }

  // ---------- Share ----------
  function shareLabel(value) {
    return String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }
  function buildShareText() {
    var tip = state.tipPercent || 0;
    var balances = R.computeBalances(state.participants, state.expenses, { tipPercent: tip });
    var totals = R.eventTotals(state.expenses, tip);
    var sorted = balances.slice().sort(function (a, b) { return b.balance - a.balance; });
    var L = [];
    L.push('*' + t('shareHeading') + '*');
    L.push('🧾 ' + (shareLabel(state.eventName) || t('shareEvent')));
    if (validDate(state.eventDate)) {
      L.push('📅 ' + new Date(state.eventDate + 'T00:00:00').toLocaleDateString(locale(), {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }));
    }
    L.push('👥 ' + t('sharePeople', { people: state.participants.length, expenses: state.expenses.length }));
    L.push('');
    L.push('*' + t('shareTotal') + ': ' + fmt(totals.total) + '*');
    if (tip > 0) L.push(t('shareTip', { percent: tip, amount: fmt(totals.tip) }));
    L.push('');
    L.push('*' + t('shareBalances') + '*');
    sorted.forEach(function (b) {
      var status = b.balance > 0 ? t('receive') + ' ' + fmt(b.balance) : b.balance < 0 ? t('oweShare') + ' ' + fmt(-b.balance) : t('upToDate');
      L.push('• ' + shareLabel(b.name) + ' — ' + status);
    });
    var transfers = R.simplifyDebts(balances);
    if (transfers.length) {
      L.push('');
      L.push('*' + t('shareTransfers') + '*');
      transfers.forEach(function (x, i) {
        L.push((i + 1) + '. ' + shareLabel(x.fromName) + ' ' + t('paysTo', { amount: fmt(x.amount) }) + ' ' + shareLabel(x.toName));
      });
    } else {
      L.push('');
      L.push(t('allSettledText'));
    }
    L.push('');
    L.push(t('calculatedWith'));
    return L.join('\n');
  }
  function shareWhatsApp() {
    var text = buildShareText();
    if (navigator.share) {
      navigator.share({ title: shareLabel(state.eventName) || t('shareEvent'), text: text })
        .catch(function (error) { if (error.name !== 'AbortError') openWa(text); });
    } else { openWa(text); }
  }
  function openWa(text) {
    // noopener: la ventana nueva no puede controlar esta página.
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
  }
  function copySummary() {
    var text = buildShareText();
    var btn = $('copySum');
    function done(success) {
      if (!btn) return;
      var original = btn.textContent;
      btn.textContent = success ? t('copied') : t('copyFailed');
      setTimeout(function () { btn.textContent = original; }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }).catch(function () { done(legacyCopy(text)); });
    } else { done(legacyCopy(text)); }
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
    ta.select();
    var copied = false;
    try { copied = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return copied;
  }

  // ---------- Participants ----------
  function addPerson(name) {
    name = (name || '').trim().slice(0, 40);
    if (!name) return;
    state.participants.push({ id: uid(), name: name, color: AVATAR_COLORS[state.participants.length % AVATAR_COLORS.length] });
    save(); render();
  }
  function removePerson(id) {
    state.expenses.forEach(function (e) {
      if (e.paidBy === id) e.paidBy = null;
      e.participants = e.participants.filter(function (pid) { return pid !== id; });
    });
    state.expenses = state.expenses.filter(function (e) { return e.paidBy && e.participants.length; });
    state.participants = state.participants.filter(function (p) { return p.id !== id; });
    save(); render();
  }

  // ---------- Expense modal ----------
  function openExpense(id) {
    if (!state.participants.length) { state.tab = 'personas'; render(); return; }
    editingId = id || null;
    var e = id ? state.expenses.filter(function (x) { return x.id === id; })[0] : null;
    $('expTitle').textContent = e ? t('editExpense') : t('newExpense');
    $('expDesc').value = e ? (e.description || '') : '';
    $('expAmount').value = e ? (e.amount / factor()) : '';
    $('expAmount').step = cur().decimals === 0 ? '1' : '0.01';
    $('curSign').textContent = cur().sign;
    $('expErr').textContent = '';
    $('expDelete').hidden = !e;
    $('expTip').checked = e ? (e.tip !== false) : true;

    var selectedCat = e ? e.category : 'comida';
    $('catChips').innerHTML = CATEGORIES.map(function (c) {
      return '<button type="button" class="chip' + (c.id === selectedCat ? ' active' : '') + '" data-cat="' + c.id + '">' + c.icon + ' ' + catLabel(c) + '</button>';
    }).join('');

    var payer = e ? e.paidBy : state.participants[0].id;
    $('payerChips').innerHTML = state.participants.map(function (p) { return chipPerson(p, 'payer', p.id === payer); }).join('');

    var included = e ? e.participants.slice() : state.participants.map(function (p) { return p.id; });
    $('splitChips').innerHTML = state.participants.map(function (p) { return chipPerson(p, 'split', included.indexOf(p.id) !== -1); }).join('');

    $('expOverlay').classList.add('open');
    setTimeout(function () { $('expAmount').focus(); }, 80);
  }
  function chipPerson(p, kind, active) {
    return '<button type="button" class="chip' + (active ? ' active' : '') + '" data-' + kind + '="' + esc(p.id) + '">' +
      '<span class="av" style="background:' + esc(p.color) + '">' + esc(initials(p.name)) + '</span>' + esc(p.name) + '</button>';
  }
  function closeExpense() { $('expOverlay').classList.remove('open'); editingId = null; }

  function saveExpense(ev) {
    ev.preventDefault();
    var amount = parseAmount($('expAmount').value);
    var catEl = document.querySelector('#catChips .chip.active');
    var payerEl = document.querySelector('#payerChips .chip.active');
    var splitEls = document.querySelectorAll('#splitChips .chip.active');
    var err = $('expErr');

    if (amount <= 0) { err.textContent = t('amountError'); return; }
    if (!payerEl) { err.textContent = t('payerError'); return; }
    if (!splitEls.length) { err.textContent = t('splitError'); return; }

    var obj = {
      id: editingId || uid(),
      description: $('expDesc').value.trim().slice(0, 60),
      amount: amount,
      category: catEl ? catEl.dataset.cat : 'otros',
      paidBy: payerEl.dataset.payer,
      participants: Array.prototype.map.call(splitEls, function (el) { return el.dataset.split; }),
      tip: $('expTip').checked
    };
    if (editingId) state.expenses = state.expenses.map(function (x) { return x.id === editingId ? obj : x; });
    else state.expenses.push(obj);
    save(); closeExpense(); state.tab = 'gastos'; render();
  }
  function deleteExpense() {
    if (!editingId) return;
    if (!confirm(t('confirmDelete'))) return;
    state.expenses = state.expenses.filter(function (x) { return x.id !== editingId; });
    save(); closeExpense(); render();
  }

  // ---------- Currency ----------
  function changeCurrency(newCode) {
    if (!CURRENCIES[newCode] || newCode === state.currency) return;
    var oldF = factor();
    var newF = Math.pow(10, CURRENCIES[newCode].decimals);
    if (oldF !== newF) {
      // Reescala preservando el número que el usuario escribió (NO es tipo de cambio).
      state.expenses.forEach(function (e) { e.amount = Math.round(e.amount / oldF * newF); });
    }
    state.currency = newCode;
    save(); render();
  }
  function changeLanguage(language) {
    if (!TEXT[language] || language === state.language) return;
    var calendarMessageKey = ['loginForCloud', 'cloudUnavailable'].filter(function (key) {
      return calendarMessage === t(key);
    })[0];
    state.language = language;
    if (calendarMessageKey) calendarMessage = t(calendarMessageKey);
    save(); render();
    if ($('expOverlay').classList.contains('open')) {
      document.querySelectorAll('#catChips [data-cat]').forEach(function (button) {
        var category = catOf(button.dataset.cat);
        button.textContent = category.icon + ' ' + catLabel(category);
      });
    }
  }

  // ---------- Example ----------
  function loadExample() {
    stopCloudSync();
    state.historyId = uid();
    state.eventName = t('exampleEvent');
    state.currency = 'BRL';
    state.tipPercent = 0;
    state.cloudId = null;
    resetCloudPaymentState();
    state.cloudVersion = null;
    state.cloudBaseline = null;
    state.codigo = null;
    state.participants = [];
    var ids = {};
    ['Ana', 'Beto', 'Caro', 'Dani', 'Eli'].forEach(function (n, i) {
      var id = uid(); ids[n] = id;
      state.participants.push({ id: id, name: n, color: AVATAR_COLORS[i % AVATAR_COLORS.length] });
    });
    state.expenses = [
      { id: uid(), description: t('exampleFood'), amount: 20000, category: 'comida', paidBy: ids.Ana, participants: [ids.Ana, ids.Beto, ids.Caro, ids.Dani, ids.Eli] },
      { id: uid(), description: t('exampleBeer'), amount: 15000, category: 'alcohol', paidBy: ids.Beto, participants: [ids.Ana, ids.Beto, ids.Caro] },
      { id: uid(), description: t('exampleDrinks'), amount: 6000, category: 'bebidas', paidBy: ids.Dani, participants: [ids.Dani, ids.Eli] }
    ];
    state.tab = 'resumen';
    save(); render();
  }
  function resetAll() {
    if (!confirm(t('confirmReset'))) return;
    stopCloudSync();
    state.eventName = ''; state.tipPercent = 0; state.participants = []; state.expenses = []; state.tab = 'personas';
    state.currency = 'BRL';
    state.eventDate = localDate(new Date()); state.historyId = uid();
    state.cloudId = null; state.codigo = null;
    resetCloudPaymentState();
    state.cloudVersion = null;
    state.cloudBaseline = null;
    save(); render();
  }

  // ---------- Theme ----------
  function applyTheme() {
    if (state.theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', state.theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var dark = state.theme === 'dark' || (state.theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      meta.setAttribute('content', dark ? '#0b0f17' : '#6d5efc');
    }
  }
  function cycleTheme() {
    state.theme = state.theme === 'system' ? 'light' : state.theme === 'light' ? 'dark' : 'system';
    save(); applyTheme(); render();
  }

  // ---------- Menu ----------
  function openMenu() { $('menuOverlay').classList.add('open'); }
  function closeMenu() { $('menuOverlay').classList.remove('open'); }

  // ---------- Cuenta / Nube (Supabase) ----------
  function cloudReady() { return !!(window.Cloud && window.Cloud.available); }
  function canWriteCloud() {
    return !!(profileReady && cloudAccessReady && cloudAccess && cloudAccess.can_write === true);
  }
  function updateCloudTrialUI() {
    var status = $('trialStatus');
    if (!status) return;
    status.classList.remove('trial-active', 'trial-expired');
    if (!currentSession || !profileReady) {
      status.hidden = true;
    } else {
      status.hidden = false;
      if (!cloudAccessReady) {
        status.textContent = t('trialVerifying');
        status.classList.add('trial-active');
      } else if (cloudAccessError || !cloudAccess) {
        status.textContent = t('trialUnavailable');
        status.classList.add('trial-expired');
      } else if (!canWriteCloud()) {
        status.textContent = t('trialExpired');
        status.classList.add('trial-expired');
      } else if (cloudAccess.status === 'paid') {
        status.textContent = t('trialPaid', { date: new Date(cloudAccess.access_until).toLocaleDateString() });
        status.classList.add('trial-active');
      } else {
        status.textContent = t('trialActive', { days: cloudAccess.days_remaining });
        status.classList.add('trial-active');
      }
    }
    $('cloudSave').disabled = !canWriteCloud();
    $('joinCode').disabled = !canWriteCloud();
    $('joinBtn').disabled = !canWriteCloud();
  }
  function refreshCloudAccess() {
    cloudAccess = null;
    cloudAccessReady = false;
    cloudAccessError = null;
    updateCloudTrialUI();
    return window.Cloud.getCloudAccess().then(function (result) {
      cloudAccessError = result.error || null;
      cloudAccess = result.error ? null : result.data;
      cloudAccessReady = true;
      updateCloudTrialUI();
      if (state.tab === 'resumen') renderSummary();
    }).catch(function (error) {
      cloudAccessError = error;
      cloudAccess = null;
      cloudAccessReady = true;
      updateCloudTrialUI();
    });
  }
  function showTrialExpired() {
    cloudAccess = { status: 'expired', can_write: false, days_remaining: 0 };
    cloudAccessReady = true;
    cloudAccessError = null;
    updateCloudTrialUI();
    if (state.tab === 'resumen') renderSummary();
  }
  function isTrialExpiredError(error) {
    return !!(error && String(error.message || '').indexOf('CLOUD_TRIAL_EXPIRED') !== -1);
  }
  function requireCloudWriteAccess(messageId) {
    if (!requireCloudSession()) return false;
    if (canWriteCloud()) return true;
    var targetId = messageId || 'cloudMsg';
    $(targetId).textContent = !cloudAccessReady ? t('trialVerifying') :
      (cloudAccessError || !cloudAccess ? t('trialUnavailable') : t('trialExpired'));
    if (targetId === 'calendarSaveFeedback') $(targetId).hidden = false;
    return false;
  }
  function isCloudOwner() {
    return !!(state.cloudId && state.paymentSchemaAvailable && currentSession && profileReady &&
      state.cloudOwnerId && currentSession.user && currentSession.user.id === state.cloudOwnerId);
  }
  function requireCloudSession() {
    if (currentSession && currentSession.user && profileReady) return true;
    openAuth();
    $('authMsg').textContent = !cloudReady() ? t('authUnavailable') : (currentSession ? t('profileRepairFailed') : t('cloudLoginRequired'));
    return false;
  }
  function ensureProfileForSession() {
    return window.Cloud.ensureProfile().then(function (res) {
      if (res.error) throw res.error;
      profileReady = true;
      return refreshCloudAccess().then(function () {
        if (currentSession) refreshAccountUI(currentSession);
        return res;
      });
    });
  }
  function refreshAccountUI(session) {
    var headerEmail = $('headerAccountEmail');
    if (passwordRecoveryMode) {
      headerEmail.hidden = true;
      $('authLoggedOut').hidden = true;
      $('authLoggedIn').hidden = true;
      $('authResetPassword').hidden = false;
      updateCloudTrialUI();
      return;
    }
    var user = profileReady && session && session.user;
    var email = user ? user.email : null;
    if (email) {
      headerEmail.textContent = email;
      headerEmail.title = email;
      headerEmail.hidden = false;
      var name = user.user_metadata && user.user_metadata.full_name;
      $('accountLabel').textContent = name ? name : email;
      $('authLoggedOut').hidden = true;
      $('authLoggedIn').hidden = false;
      $('authEmailShown').textContent = (name ? name + ' · ' : '') + email;
      var info = $('cloudSavedInfo');
      if (state.cloudId && state.codigo) {
        info.hidden = false;
        info.innerHTML = t('savedInCloud') + ' <strong>' + esc(state.codigo) + '</strong>';
      } else { info.hidden = true; }
    } else {
      headerEmail.textContent = '';
      headerEmail.removeAttribute('title');
      headerEmail.hidden = true;
      $('accountLabel').textContent = cloudReady() ? t('loginButton') : t('cloudUnavailable');
      $('authLoggedOut').hidden = false;
      $('authLoggedIn').hidden = true;
    }
    updateCloudTrialUI();
  }
  function openAuth() {
    closeMenu();
    $('authMsg').textContent = '';
    $('authCancel').hidden = false;
    if (!cloudReady()) $('authMsg').textContent = t('authUnavailable');
    if (passwordRecoveryMode) {
      $('authLoggedOut').hidden = true;
      $('authLoggedIn').hidden = true;
      $('authResetPassword').hidden = false;
    }
    $('authOverlay').classList.add('open');
  }
  function closeAuth() {
    $('authOverlay').classList.remove('open');
  }
  function authCreds() { return { email: $('authEmail').value.trim(), pass: $('authPass').value }; }
  function authSignIn() {
    if (!cloudReady()) return;
    var c = authCreds();
    if (!c.email || !c.pass) { $('authMsg').textContent = t('credentialsRequired'); return; }
    $('authMsg').textContent = t('signingIn');
    window.Cloud.signIn(c.email, c.pass).then(function (res) {
      if (res.error) { $('authMsg').textContent = t('signInFailed', { error: res.error.message }); return; }
      currentSession = res.data && res.data.session ? res.data.session : currentSession;
      profileReady = false;
      refreshAccountUI(null);
      $('authCancel').hidden = false;
      ensureProfileForSession().then(function () {
        closeAuth();
        if (state.cloudId) startCloudSync();
        $('cloudMsg').textContent = t('sessionStarted');
        window.Cloud.logActivity('inicio_sesion').then(function (log) {
          if (log.error) $('cloudMsg').textContent = t('activityError');
        }).catch(function () { $('cloudMsg').textContent = t('activityError'); });
      }).catch(function () {
        profileReady = false;
        refreshAccountUI(null);
        $('authMsg').textContent = t('profileRepairFailed');
      });
      $('authPass').value = ''; // onAuth refresca la UI
    }).catch(function (e) { $('authMsg').textContent = t('generalError', { error: e.message }); });
  }
  function authSignUp() {
    if (!cloudReady()) return;
    var c = authCreds();
    var name = $('authName').value.trim();
    if (!c.email || !c.pass) { $('authMsg').textContent = t('credentialsRequired'); return; }
    if (!name) { $('authMsg').textContent = t('nameRequired'); return; }
    if (c.pass.length < 6) { $('authMsg').textContent = t('passwordLength'); return; }
    $('authMsg').textContent = t('creatingAccount');
    window.Cloud.signUp(c.email, c.pass, name).then(function (res) {
      if (res.error) { $('authMsg').textContent = t('createFailed', { error: res.error.message }); return; }
      if (res.data && res.data.session) {
        currentSession = res.data.session;
        profileReady = false;
        refreshAccountUI(null);
        $('authCancel').hidden = false;
        $('authPass').value = '';
        ensureProfileForSession().then(function () {
          $('cloudMsg').textContent = t('accountCreated');
          closeAuth();
        }).catch(function () {
          profileReady = false;
          refreshAccountUI(null);
          $('authMsg').textContent = t('profileRepairFailed');
        });
      } else {
        $('authMsg').textContent = t('confirmEmail');
      }
    }).catch(function (e) { $('authMsg').textContent = t('generalError', { error: e.message }); });
  }
  function authRequestPasswordReset() {
    if (!cloudReady()) { $('authMsg').textContent = t('authUnavailable'); return; }
    var email = $('authEmail').value.trim();
    if (!email) { $('authMsg').textContent = t('resetEmailRequired'); return; }
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
      $('authMsg').textContent = t('resetHttpRequired'); return;
    }
    var button = $('authForgotPassword');
    button.disabled = true;
    $('authMsg').textContent = t('sendingResetLink');
    var redirectTo = window.location.origin + window.location.pathname;
    window.Cloud.requestPasswordReset(email, redirectTo).then(function (res) {
      if (res.error) { $('authMsg').textContent = t('resetLinkFailed'); return; }
      $('authMsg').textContent = t('resetLinkSent');
    }).catch(function () {
      $('authMsg').textContent = t('resetLinkFailed');
    }).then(function () { button.disabled = false; });
  }
  function authUpdatePassword() {
    if (!cloudReady() || !passwordRecoveryMode) return;
    var password = $('authNewPassword').value;
    if (password.length < 6) { $('authResetMsg').textContent = t('passwordLength'); return; }
    var button = $('authResetSubmit');
    button.disabled = true;
    $('authResetMsg').textContent = '';
    window.Cloud.updatePassword(password).then(function (res) {
      if (res.error) { $('authResetMsg').textContent = t('resetPasswordFailed'); return; }
      ensureProfileForSession().then(function () {
        passwordRecoveryMode = false;
        $('authResetPassword').hidden = true;
        $('authNewPassword').value = '';
        refreshAccountUI(currentSession);
        $('cloudMsg').textContent = t('passwordUpdated');
        closeAuth();
      }).catch(function () {
        $('authResetMsg').textContent = t('profileRepairFailed');
      });
    }).catch(function () {
      $('authResetMsg').textContent = t('resetPasswordFailed');
    }).then(function () { button.disabled = false; });
  }
  function cancelPasswordRecovery() {
    passwordRecoveryMode = false;
    currentSession = null;
    profileReady = false;
    $('authResetPassword').hidden = true;
    $('authNewPassword').value = '';
    refreshAccountUI(null);
    closeAuth();
    if (cloudReady()) window.Cloud.signOut().catch(function () {});
  }
  function authSignOut() {
    if (!cloudReady()) return;
    window.Cloud.logActivity('cierre_sesion').then(function () {
      return window.Cloud.signOut();
    }).catch(function () { return window.Cloud.signOut(); });
  }

  // ---------- Nube: datos (guardar / historial / compartir) ----------
  function assignColors(parts) {
    parts.forEach(function (p, i) { if (!p.color) p.color = AVATAR_COLORS[i % AVATAR_COLORS.length]; });
    return parts;
  }
  function applyLoadedEvent(d) {
    var ev = d.evento;
    var localRecord = localHistory.filter(function (item) { return item.cloudId === ev.id; })[0];
    state.cloudId = ev.id;
    state.cloudVersion = Number(ev.version) || 0;
    state.cloudOwnerId = ev.owner || null;
    state.financialFingerprint = ev.financial_fingerprint || null;
    state.paymentSchemaAvailable = d.paymentSchemaAvailable !== false;
    state.transferPayments = {};
    (d.transferencia_pagos || []).forEach(function (payment) {
      state.transferPayments[transferPaymentKey(payment.pagador_key, payment.receptor_key)] = payment;
    });
    state.codigo = ev.codigo;
    state.historyId = localRecord ? localRecord.historyId : 'cloud-' + ev.id;
    state.eventName = ev.nombre || '';
    state.eventDate = validDate(ev.fecha) ? ev.fecha : localDate(new Date());
    state.currency = CURRENCIES[ev.moneda] ? ev.moneda : 'BRL';
    state.tipPercent = Number(ev.tip_percent) || 0;
    var participantKeys = {};
    state.participants = assignColors((d.participantes || []).map(function (p) {
      var key = p.client_key || p.id;
      participantKeys[p.id] = key;
      return { id: key, name: p.nombre, color: p.color };
    }));
    state.expenses = (d.gastos || []).map(function (g) {
      return {
        id: g.id,
        description: g.descripcion || '',
        amount: Number(g.monto) || 0,
        category: g.categoria || 'otros',
        paidBy: participantKeys[g.pagado_por] || g.pagado_por,
        tip: g.aplica_propina !== false,
        participants: (d.gasto_participante || [])
          .filter(function (x) { return x.gasto_id === g.id; })
          .map(function (x) { return participantKeys[x.participante_id] || x.participante_id; })
      };
    });
    state.tab = 'resumen';
    syncBaseline = eventSnapshot(); state.cloudBaseline = syncBaseline; remoteConflict = false;
    save(); render();
    subscribeCurrentEvent();
  }
  function cloudSave(buttonId, messageId) {
    buttonId = buttonId || 'cloudSave';
    messageId = messageId || 'cloudMsg';
    function setMessage(text) {
      var message = $(messageId);
      if (!message) return;
      message.textContent = text;
      if (messageId === 'calendarSaveFeedback') message.hidden = !text;
    }
    if (!cloudReady()) { setMessage(t('cloudUnavailable')); return; }
    if (!requireCloudWriteAccess(messageId)) return;
    if (remoteConflict) {
      setMessage(t('saveConflict'));
      return;
    }
    var btn = $(buttonId);
    var previousCloudId = state.cloudId;
    var previousFinancialFingerprint = state.financialFingerprint;
    setMessage('');
    btn.disabled = true; cloudSaveInProgress = true; var orig = btn.textContent;
    btn.textContent = buttonId === 'saveCalendar' ? calendarSaveText('progress') : t('saveCloudButton');
    window.Cloud.saveEvent({
      cloudId: state.cloudId, cloudVersion: state.cloudVersion, codigo: state.codigo,
      eventName: state.eventName, eventDate: state.eventDate, currency: state.currency, tipPercent: state.tipPercent,
      participants: state.participants, expenses: state.expenses
    }).then(function (res) {
      cloudSaveInProgress = false;
      btn.disabled = false; btn.textContent = orig;
      if (res.error) {
        if (isTrialExpiredError(res.error)) {
          showTrialExpired();
          setMessage(t('trialExpired'));
          return;
        }
        if (res.error.message.indexOf('EVENT_CONFLICT') !== -1 || res.error.code === '40001') {
          remoteConflict = true;
          setSyncStatus(t('saveConflict'), true, true);
          setMessage(t('saveConflict'));
        } else { setMessage(t('saveFailed', { error: res.error.message })); }
        return;
      }
      state.cloudId = res.data.id; state.cloudVersion = Number(res.data.version) || 0; state.codigo = res.data.codigo;
      state.cloudOwnerId = res.data.owner || (previousCloudId ? state.cloudOwnerId : currentSession.user.id);
      state.financialFingerprint = res.data.financial_fingerprint || null;
      state.paymentSchemaAvailable = !!state.financialFingerprint;
      if (state.financialFingerprint !== previousFinancialFingerprint) state.transferPayments = {};
      syncBaseline = eventSnapshot(); state.cloudBaseline = syncBaseline; remoteConflict = false; save(); subscribeCurrentEvent();
      if (state.tab === 'resumen') renderSummary();
      setSyncStatus(t('savedCloud'), false);
      if (state.tab === 'calendario') loadCalendarEvents();
      var info = $('cloudSavedInfo');
      info.hidden = false;
      info.innerHTML = t('savedCloud') + ' · <strong>' + esc(state.codigo || '') + '</strong>';
      if (messageId === 'calendarSaveFeedback') setMessage(calendarSaveText('success'));
    }).catch(function (e) { cloudSaveInProgress = false; btn.disabled = false; btn.textContent = orig; setMessage(t('generalError', { error: e.message })); });
  }
  function openEventsList() {
    if (!cloudReady() || !requireCloudSession()) return;
    closeAuth();
    var list = $('eventsList');
    list.innerHTML = '<div class="hint">' + t('loading') + '</div>';
    $('eventsOverlay').classList.add('open');
    window.Cloud.listEvents().then(function (res) {
      if (res.error) { list.innerHTML = '<div class="err-msg">' + esc(t('generalError', { error: res.error.message })) + '</div>'; return; }
      var rows = res.data || [];
      if (!rows.length) { list.innerHTML = emptyHTML('📂', t('noCloudEvents'), t('noCloudEventsHint')); return; }
      list.innerHTML = rows.map(function (ev) {
        return '<div class="exp-card" data-open="' + esc(ev.id) + '">' +
          '<div class="exp-icon">📅</div>' +
          '<div class="exp-main"><div class="exp-top"><span class="exp-desc">' + esc(ev.nombre || t('shareEvent')) + '</span>' +
          '<span class="exp-amt" style="font-size:.78rem;color:var(--muted)">' + esc(ev.moneda || '') + '</span></div>' +
              '<div class="exp-sub">' + esc(validDate(ev.fecha) ? new Date(ev.fecha + 'T00:00:00').toLocaleDateString(locale()) : (ev.fecha || '')) + ' · ' + esc(t('dateCode', { code: ev.codigo || '' })) + '</div></div></div>';
      }).join('');
            }).catch(function (e) { list.innerHTML = '<div class="err-msg">' + esc(t('generalError', { error: e.message })) + '</div>'; });
  }
  function changeCalendarMonth(offset) {
    clearCalendarEventDetail();
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1);
    var selected = new Date(calendarSelectedDate + 'T00:00:00');
    var maxDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    calendarSelectedDate = localDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), Math.min(selected.getDate(), maxDay)));
    renderCalendar();
  }
  function loadCalendarEvents() {
    var request = ++calendarRequest;
    calendarLoading = true; calendarMessage = ''; renderCalendar();
    if (!cloudReady()) {
      calendarLoading = false; calendarEvents = [];
      calendarMessage = t('cloudUnavailable');
      renderCalendar(); return;
    }
    window.Cloud.getSession().then(function (res) {
      if (!(res && res.data && res.data.session)) {
        calendarEvents = [];
        calendarMessage = t('loginForCloud');
        return null;
      }
      return window.Cloud.listEvents();
    }).then(function (res) {
      if (request !== calendarRequest) return;
      calendarLoading = false;
      if (!res) { renderCalendar(); return; }
      if (res.error) { calendarEvents = []; calendarMessage = t('calendarLoadFailed', { error: res.error.message }); }
      else { calendarEvents = res.data || []; calendarMessage = ''; }
      renderCalendar();
    }).catch(function (error) {
      if (request !== calendarRequest) return;
      calendarLoading = false; calendarEvents = [];
      calendarMessage = t('calendarLoadFailed', { error: error.message }); renderCalendar();
    });
  }
  function renderCalendar() {
    var year = calendarMonth.getFullYear();
    var month = calendarMonth.getMonth();
    $('calendarMonth').textContent = calendarMonth.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
    var entries = localHistory.map(function (event) {
      return {
        id: event.cloudId || event.historyId,
        historyId: event.historyId,
        cloudId: event.cloudId,
        nombre: event.eventName,
        fecha: event.eventDate,
        moneda: event.currency,
        codigo: event.codigo
      };
    });
    calendarEvents.forEach(function (event) {
      if (!localHistory.some(function (localEvent) { return localEvent.cloudId === event.id; })) entries.push(event);
    });
    var eventCounts = {};
    entries.forEach(function (event) {
      if (validDate(event.fecha)) eventCounts[event.fecha] = (eventCounts[event.fecha] || 0) + 1;
    });
    var offset = (new Date(year, month, 1).getDay() + 6) % 7;
    var days = new Date(year, month + 1, 0).getDate();
    var today = localDate(new Date());
    var html = '';
    for (var blank = 0; blank < offset; blank++) html += '<span class="calendar-day blank" aria-hidden="true"></span>';
    for (var day = 1; day <= days; day++) {
      var date = localDate(new Date(year, month, day));
      var classes = 'calendar-day' + (date === today ? ' today' : '') + (date === calendarSelectedDate ? ' selected' : '') + (eventCounts[date] ? ' has-events' : '');
      var label = new Date(year, month, day).toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
      html += '<button type="button" class="' + classes + '" data-day="' + date + '" aria-label="' + esc(label + (eventCounts[date] ? ', ' + t('monthCount', { count: eventCounts[date] }) : '')) + '" aria-pressed="' + (date === calendarSelectedDate) + '">' + day + '</button>';
    }
    $('calendarGrid').innerHTML = html;
    var selected = new Date(calendarSelectedDate + 'T00:00:00');
    $('calendarSelectedTitle').textContent = selected.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
    var box = $('calendarEvents');
    if (calendarLoading) { box.innerHTML = '<div class="hint">' + t('loadingEvents') + '</div>'; renderCalendarDetail(); return; }
    var notice = calendarMessage ? '<div class="hint">' + esc(calendarMessage) + '</div>' : '';
    var loginButton = calendarMessage === t('loginForCloud') ? '<button type="button" class="btn btn-primary btn-block" data-calendar-login>' + t('loginButton') + '</button>' : '';
    var selectedEvents = entries.filter(function (event) { return event.fecha === calendarSelectedDate; });
    if (!selectedEvents.length) {
      box.innerHTML = notice + loginButton + '<div class="hint">' + t('noEventsToday') + '</div>';
      renderCalendarDetail();
      return;
    }
    box.innerHTML = notice + loginButton + selectedEvents.map(function (event) {
      var detail = event.codigo ? esc(t('dateCode', { code: event.codigo })) : t('dateSavedLocal');
      var cloudId = event.cloudId || (event.historyId ? '' : event.id);
      return '<button type="button" class="exp-card calendar-event" data-calendar-detail="true" data-history-id="' + esc(event.historyId || '') + '" data-cloud-id="' + esc(cloudId) + '">' +
        '<span class="exp-icon">📅</span><span class="exp-main"><span class="exp-top"><span class="exp-desc">' + esc(event.nombre || t('shareEvent')) + '</span>' +
        '<span class="exp-amt" style="font-size:.78rem;color:var(--muted)">' + esc(event.moneda || '') + '</span></span>' +
        '<span class="exp-sub">' + detail + '</span></span></button>';
    }).join('');
    renderCalendarDetail();
  }
  function clearCalendarEventDetail() {
    calendarDetailRequest++;
    calendarDetailId = null; calendarDetail = null; calendarDetailLoading = false; calendarDetailError = '';
    renderCalendarDetail();
  }
  function showCalendarEventDetails(historyId, cloudId) {
    var request = ++calendarDetailRequest;
    var localRecord = historyId && localHistory.filter(function (item) { return item.historyId === historyId; })[0];
    calendarDetailId = historyId || cloudId;
    calendarDetail = null; calendarDetailError = ''; calendarDetailLoading = false;
    if (cloudId && cloudReady() && currentSession) {
      calendarDetailLoading = true; renderCalendarDetail();
      window.Cloud.loadEvent(cloudId).then(function (res) {
        if (request !== calendarDetailRequest) return;
        calendarDetailLoading = false;
        if (res.error) {
          if (localRecord) calendarDetail = localRecord;
          else calendarDetailError = t('eventLoadFailed', { error: res.error.message });
        } else {
          var data = res.data;
          var event = data.evento;
          var participantKeys = {};
          (data.participantes || []).forEach(function (person) { participantKeys[person.id] = person.client_key || person.id; });
          calendarDetail = {
            eventName: event.nombre, eventDate: event.fecha, currency: event.moneda,
            codigo: event.codigo, tipPercent: Number(event.tip_percent) || 0, historyId: historyId || null, cloudId: cloudId,
            paymentSchemaAvailable: data.paymentSchemaAvailable !== false,
            transferPayments: data.transferencia_pagos || [],
            participants: (data.participantes || []).map(function (person) {
              return { id: participantKeys[person.id], name: person.nombre, color: person.color };
            }),
            expenses: (data.gastos || []).map(function (expense) {
              return {
                id: expense.id, description: expense.descripcion || '', amount: Number(expense.monto) || 0,
                category: expense.categoria || 'otros', paidBy: participantKeys[expense.pagado_por] || expense.pagado_por, tip: expense.aplica_propina !== false,
                participants: (data.gasto_participante || []).filter(function (split) { return split.gasto_id === expense.id; })
                  .map(function (split) { return participantKeys[split.participante_id] || split.participante_id; })
              };
            })
          };
        }
        renderCalendarDetail();
      }).catch(function (error) {
        if (request !== calendarDetailRequest) return;
        calendarDetailLoading = false;
        if (localRecord) calendarDetail = localRecord;
        else calendarDetailError = t('eventLoadFailed', { error: error.message });
        renderCalendarDetail();
      });
    } else if (localRecord) {
      calendarDetail = localRecord;
      renderCalendarDetail();
    } else {
      calendarDetailError = t('loginForCloud');
      renderCalendarDetail();
    }
  }
  function renderCalendarDetail() {
    var box = $('calendarEventDetail');
    if (!box) return;
    if (!calendarDetailId) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    if (calendarDetailLoading) { box.innerHTML = '<div class="hint">' + t('loading') + '</div>'; return; }
    if (calendarDetailError) { box.innerHTML = '<div class="hint">' + esc(calendarDetailError) + '</div>'; return; }
    if (!calendarDetail) { box.innerHTML = ''; return; }

    var event = calendarDetail;
    var participants = Array.isArray(event.participants) ? event.participants : [];
    var expenses = Array.isArray(event.expenses) ? event.expenses : [];
    var currency = CURRENCIES[event.currency] ? event.currency : 'BRL';
    var tip = Number(event.tipPercent) || 0;
    var totals = R.eventTotals(expenses, tip);
    var balances = R.computeBalances(participants, expenses, { tipPercent: tip });
    var nameOfDetail = function (id) {
      var person = participants.filter(function (item) { return item.id === id; })[0];
      return person ? person.name : '—';
    };
    var date = validDate(event.eventDate) ? new Date(event.eventDate + 'T00:00:00').toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
    var html = '<div class="calendar-detail-head"><div><h3>' + esc(event.eventName || t('shareEvent')) + '</h3><div class="hint">' + esc(date) + (event.codigo ? ' · ' + esc(t('dateCode', { code: event.codigo })) : '') + '</div></div>' +
      '<button type="button" class="icon-btn" data-calendar-detail-close aria-label="' + esc(t('close')) + '" title="' + esc(t('close')) + '">×</button></div>';
    html += '<div class="total-card calendar-detail-total"><div class="lbl">' + t('totalTitle') + '</div><div class="amt">' + esc(fmtForCurrency(totals.total, currency)) + '</div>' +
      '<div class="meta">' + t('expenseCount', { count: expenses.length }) + ' · ' + t('peopleCount', { count: participants.length }) + '</div>' +
      (tip > 0 ? '<div class="sub">' + t('subtotal') + ' ' + esc(fmtForCurrency(totals.subtotal, currency)) + ' + ' + t('tip') + ' ' + esc(fmtForCurrency(totals.tip, currency)) + ' (' + tip + '%)</div>' : '') + '</div>';
    html += '<div class="section-title calendar-detail-title">' + t('calendarAttendees') + '</div>';
    html += participants.length ? '<div class="chips calendar-detail-people">' + participants.map(function (person, index) {
      var color = person.color || AVATAR_COLORS[index % AVATAR_COLORS.length];
      return '<span class="chip"><span class="av" style="background:' + esc(color) + '">' + esc(initials(person.name)) + '</span>' + esc(person.name) + '</span>';
    }).join('') + '</div>' : '<div class="hint">' + esc(t('peopleEmptyTitle')) + '</div>';
    html += '<div class="section-title calendar-detail-title">' + t('expensesHeading') + '</div>';
    html += expenses.length ? expenses.map(function (expense) {
      var names = (expense.participants || []).map(nameOfDetail);
      var noTip = tip > 0 && expense.tip === false ? ' · ' + t('noTipSuffix') : '';
      var subtitle = t('expensePaidBy', { name: esc(nameOfDetail(expense.paidBy)), count: names.length, people: esc(names.join(', ')), noTip: noTip });
      return '<div class="exp-card calendar-detail-expense"><span class="exp-icon">' + catOf(expense.category).icon + '</span><span class="exp-main"><span class="exp-top"><span class="exp-desc">' + esc(expense.description || catLabel(catOf(expense.category))) + '</span><span class="exp-amt">' + esc(fmtForCurrency(expense.amount, currency)) + '</span></span><span class="exp-sub">' + subtitle + '</span></span></div>';
    }).join('') : '<div class="hint">' + esc(t('expensesEmptyTitle')) + '</div>';
    html += '<div class="section-title calendar-detail-title">' + t('balances') + '</div>';
    html += balances.slice().sort(function (a, b) { return b.balance - a.balance; }).map(function (balance, index) {
      var person = participants.filter(function (item) { return item.id === balance.id; })[0];
      var color = person && person.color || AVATAR_COLORS[index % AVATAR_COLORS.length];
      var amount = balance.balance > 0 ? '+' + fmtForCurrency(balance.balance, currency) : balance.balance < 0 ? '−' + fmtForCurrency(-balance.balance, currency) : fmtForCurrency(0, currency);
      var label = balance.balance > 0 ? t('receives') : balance.balance < 0 ? t('owesVerb') : t('upToDate');
      var pill = balance.balance > 0 ? 'pill-pos' : balance.balance < 0 ? 'pill-neg' : 'pill-zero';
      return '<div class="person-card"><div class="avatar" style="background:' + esc(color) + '">' + esc(initials(balance.name)) + '</div><div class="pc-main"><div class="pc-name">' + esc(balance.name) + '</div><div class="pc-sub">' + t('paid') + ' ' + esc(fmtForCurrency(balance.paid, currency)) + ' · ' + t('owes') + ' ' + esc(fmtForCurrency(balance.owes, currency)) + '</div></div><div class="pill ' + pill + '">' + esc(amount) + '<small>' + label + '</small></div></div>';
    }).join('');
    var transfers = R.simplifyDebts(balances);
    var transferPayments = {};
    (event.transferPayments || []).forEach(function (payment) {
      transferPayments[transferPaymentKey(payment.pagador_key, payment.receptor_key)] = payment;
    });
    html += '<div class="section-title calendar-detail-title">' + t('settle') + '</div>';
    html += transfers.length ? '<div class="settle-card">' + transfers.map(function (transfer) {
      var row = '<div class="transfer-payment-row"><div class="transfer"><span class="t-name">' + esc(transfer.fromName) + '</span><span class="t-mid">→ <span class="t-amt">' + esc(fmtForCurrency(transfer.amount, currency)) + '</span> →</span><span class="t-name">' + esc(transfer.toName) + '</span></div>';
      if (event.cloudId && event.paymentSchemaAvailable) {
        var payment = transferPayments[transferPaymentKey(transfer.from, transfer.to)];
        var paid = payment && Number(payment.monto_deuda) === transfer.amount ? Number(payment.monto_pagado) || 0 : 0;
        paid = Math.max(0, Math.min(transfer.amount, paid));
        var remaining = transfer.amount - paid;
        var statusClass = paid === 0 ? 'payment-unpaid' : remaining === 0 ? 'payment-paid' : 'payment-partial';
        var statusText = paid === 0 ? t('paymentUnpaid') : remaining === 0 ? t('paymentPaid') : t('paymentPartial');
        row += '<div class="transfer-payment-status"><strong class="' + statusClass + '">' + statusText + '</strong><span>' + t('paymentAmountLabel') + ': ' + esc(fmtForCurrency(paid, currency)) + ' · ' + t('paymentRemaining') + ': ' + esc(fmtForCurrency(remaining, currency)) + '</span></div>';
      }
      return row + '</div>';
    }).join('') + '</div>' : '<div class="settle-card" style="text-align:center;color:var(--muted)">' + t('allSettled') + '</div>';
    var openAttrs = event.cloudId ? 'data-calendar-open-cloud="' + esc(event.cloudId) + '"' : 'data-calendar-open-history="' + esc(event.historyId || '') + '"';
    html += '<button type="button" class="btn btn-primary btn-block calendar-detail-open" ' + openAttrs + '>' + t('calendarOpenEvent') + '</button>';
    box.innerHTML = html;
  }
  function closeEventsList() { $('eventsOverlay').classList.remove('open'); }
  function applyLocalHistoryEvent(event) {
    stopCloudSync();
    state.historyId = event.historyId;
    state.cloudId = event.cloudId || null;
    resetCloudPaymentState();
    state.cloudVersion = Number.isInteger(event.cloudVersion) ? event.cloudVersion : null;
    state.cloudBaseline = event.cloudBaseline || null;
    state.codigo = event.codigo || null;
    state.eventName = event.eventName || '';
    state.eventDate = validDate(event.eventDate) ? event.eventDate : localDate(new Date());
    state.currency = CURRENCIES[event.currency] ? event.currency : 'BRL';
    state.tipPercent = Number(event.tipPercent) || 0;
    state.participants = JSON.parse(JSON.stringify(event.participants || []));
    state.expenses = JSON.parse(JSON.stringify(event.expenses || []));
    state.tab = 'personas';
    syncBaseline = state.cloudBaseline;
    remoteConflict = !!state.cloudId && (!syncBaseline || eventSnapshot() !== syncBaseline);
    save(); render(); closeEventsList();
    if (state.cloudId && !remoteConflict) subscribeCurrentEvent();
    if (remoteConflict) setSyncStatus(t('syncLocal'), true, true);
  }
  function openLocalHistoryEvent(id) {
    var event = localHistory.filter(function (item) { return item.historyId === id; })[0];
    if (!event) return;
    if (event.cloudId && cloudReady()) { openCloudEvent(event.cloudId, event.historyId); return; }
    applyLocalHistoryEvent(event);
  }
  function openCloudEvent(id, fallbackHistoryId) {
    if (!cloudReady()) {
      if (fallbackHistoryId) openLocalHistoryEventOffline(fallbackHistoryId);
      return;
    }
    if (!requireCloudSession()) {
      if (fallbackHistoryId) openLocalHistoryEventOffline(fallbackHistoryId);
      return;
    }
    window.Cloud.loadEvent(id).then(function (res) {
      if (res.error) {
        if (fallbackHistoryId) { openLocalHistoryEventOffline(fallbackHistoryId); return; }
        alert(t('eventLoadFailed', { error: res.error.message })); return;
      }
      applyLoadedEvent(res.data);
      closeEventsList();
    }).catch(function (e) {
      if (fallbackHistoryId) { openLocalHistoryEventOffline(fallbackHistoryId); return; }
      alert(t('generalError', { error: e.message }));
    });
  }
  function openLocalHistoryEventOffline(id) {
    var event = localHistory.filter(function (item) { return item.historyId === id; })[0];
    if (event) applyLocalHistoryEvent(event);
  }
  function newCloudEvent() {
    stopCloudSync();
    state.eventName = ''; state.eventDate = localDate(new Date()); state.tipPercent = 0; state.participants = []; state.expenses = [];
    state.currency = 'BRL';
    state.historyId = uid();
    state.cloudId = null; state.cloudVersion = null; state.cloudBaseline = null; state.codigo = null; state.tab = 'personas';
    resetCloudPaymentState();
    $('cloudSavedInfo').hidden = true;
    save(); render(); closeAuth();
  }
  function joinByCodeUI() {
    if (!cloudReady() || !requireCloudWriteAccess()) return;
    var code = $('joinCode').value.trim().toUpperCase();
    if (!code) { $('cloudMsg').textContent = t('noCode'); return; }
    $('cloudMsg').textContent = t('searchingCode');
    window.Cloud.joinByCode(code).then(function (res) {
      if (res.error) {
        if (isTrialExpiredError(res.error)) {
          showTrialExpired();
          $('cloudMsg').textContent = t('trialExpired');
        } else $('cloudMsg').textContent = t('codeSearchFailed', { error: res.error.message });
        return;
      }
      $('cloudMsg').textContent = '';
      $('joinCode').value = '';
      openCloudEvent(res.data);
      closeAuth();
    }).catch(function (e) { $('cloudMsg').textContent = t('generalError', { error: e.message }); });
  }

  // ---------- Events ----------
  function singleSelect(sel, el) {
    document.querySelectorAll(sel + ' .chip').forEach(function (c) { c.classList.remove('active'); });
    el.classList.add('active');
  }
  function bind() {
    $('brandInfoBtn').addEventListener('click', function () {
      var expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', String(!expanded));
      $('appDescription').hidden = expanded;
    });
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        state.tab = t.dataset.tab; save(); render();
        if (state.tab === 'calendario') loadCalendarEvents();
      });
    });
    $('eventName').addEventListener('input', function () { state.eventName = this.value; save(); });
    $('eventDate').addEventListener('change', function () { if (validDate(this.value)) { state.eventDate = this.value; save(); } });
    $('syncReload').addEventListener('click', reloadCurrentEvent);
    $('currencyHeader').addEventListener('change', function () { changeCurrency(this.value); });
    $('languageHeader').addEventListener('change', function () { changeLanguage(this.value); });
    $('addPersonForm').addEventListener('submit', function (e) { e.preventDefault(); addPerson($('personName').value); $('personName').value = ''; $('personName').focus(); });
    $('peopleList').addEventListener('click', function (e) { var b = e.target.closest('[data-remove]'); if (b) removePerson(b.dataset.remove); });
    $('expList').addEventListener('click', function (e) { var c = e.target.closest('[data-edit]'); if (c) openExpense(c.dataset.edit); });
    $('fab').addEventListener('click', function () { openExpense(null); });

    $('expForm').addEventListener('submit', saveExpense);
    $('summaryContent').addEventListener('click', function (e) {
      var saveCalendarButton = e.target.closest('#saveCalendar');
      if (saveCalendarButton) { cloudSave('saveCalendar', 'calendarSaveFeedback'); return; }
      var action = e.target.closest('[data-payment-action]');
      if (!action) return;
      var form = action.closest('[data-transfer-payment-form]');
      if (!form) return;
      var amount = action.dataset.paymentAction === 'paid' ? Number(form.dataset.dueAmount) : 0;
      saveTransferPayment(form.dataset.payerKey, form.dataset.receiverKey, Number(form.dataset.dueAmount), amount, form);
    });
    $('summaryContent').addEventListener('submit', function (e) {
      var form = e.target.closest('[data-transfer-payment-form]');
      if (!form) return;
      e.preventDefault();
      var input = form.querySelector('.payment-amount');
      var parsed = input.value.trim() === '' ? NaN : Number(input.value.replace(',', '.'));
      var amount = isFinite(parsed) ? Math.round(parsed * factor()) : NaN;
      if (!Number.isSafeInteger(amount) || amount < 0 || amount > Number(form.dataset.dueAmount)) {
        form.querySelector('[data-payment-feedback]').textContent = t('paymentAmountInvalid', { amount: fmt(Number(form.dataset.dueAmount)) });
        return;
      }
      saveTransferPayment(form.dataset.payerKey, form.dataset.receiverKey, Number(form.dataset.dueAmount), amount, form);
    });
    $('expCancel').addEventListener('click', closeExpense);
    $('expDelete').addEventListener('click', deleteExpense);
    $('catChips').addEventListener('click', function (e) { var c = e.target.closest('[data-cat]'); if (c) singleSelect('#catChips', c); });
    $('payerChips').addEventListener('click', function (e) { var c = e.target.closest('[data-payer]'); if (c) singleSelect('#payerChips', c); });
    $('splitChips').addEventListener('click', function (e) { var c = e.target.closest('[data-split]'); if (c) c.classList.toggle('active'); });
    $('selAll').addEventListener('click', function () { document.querySelectorAll('#splitChips .chip').forEach(function (c) { c.classList.add('active'); }); });
    $('selNone').addEventListener('click', function () { document.querySelectorAll('#splitChips .chip').forEach(function (c) { c.classList.remove('active'); }); });

    $('menuBtn').addEventListener('click', openMenu);
    $('menuClose').addEventListener('click', closeMenu);
    $('menuNewEvent').addEventListener('click', function () {
      closeMenu();
      if (confirm(t('confirmNew'))) newCloudEvent();
    });
    $('menuExample').addEventListener('click', function () { closeMenu(); loadExample(); });
    $('menuReset').addEventListener('click', function () { closeMenu(); resetAll(); });
    $('themeBtn').addEventListener('click', cycleTheme);

    // cuenta / nube
    $('menuAccount').addEventListener('click', openAuth);
    $('authCancel').addEventListener('click', closeAuth);
    $('authClose2').addEventListener('click', closeAuth);
    $('authSignIn').addEventListener('click', authSignIn);
    $('authSignUp').addEventListener('click', authSignUp);
    $('authForgotPassword').addEventListener('click', authRequestPasswordReset);
    $('authResetSubmit').addEventListener('click', authUpdatePassword);
    $('authResetCancel').addEventListener('click', cancelPasswordRecovery);
    $('authSignOut').addEventListener('click', authSignOut);
    $('authOverlay').addEventListener('click', function (e) { if (e.target === this) closeAuth(); });

    // nube: datos
    $('cloudSave').addEventListener('click', function () { cloudSave(); });
    $('cloudList').addEventListener('click', openEventsList);
    $('cloudNew').addEventListener('click', function () { if (confirm(t('newCloudConfirm'))) newCloudEvent(); });
    $('joinBtn').addEventListener('click', joinByCodeUI);
    $('eventsClose').addEventListener('click', closeEventsList);
    $('eventsList').addEventListener('click', function (e) { var c = e.target.closest('[data-open]'); if (c) openCloudEvent(c.dataset.open); });
    $('eventsOverlay').addEventListener('click', function (e) { if (e.target === this) closeEventsList(); });
    $('calendarPrev').addEventListener('click', function () { changeCalendarMonth(-1); });
    $('calendarNext').addEventListener('click', function () { changeCalendarMonth(1); });
    $('calendarToday').addEventListener('click', function () {
      clearCalendarEventDetail();
      var today = new Date(); calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      calendarSelectedDate = localDate(today); renderCalendar();
    });
    $('calendarGrid').addEventListener('click', function (e) {
      var day = e.target.closest('[data-day]');
      if (day) { clearCalendarEventDetail(); calendarSelectedDate = day.dataset.day; renderCalendar(); }
    });
    $('calendarEvents').addEventListener('click', function (e) {
      var event = e.target.closest('[data-calendar-detail]');
      if (event) { showCalendarEventDetails(event.dataset.historyId, event.dataset.cloudId); return; }
      var login = e.target.closest('[data-calendar-login]');
      if (login) openAuth();
    });
    $('calendarEventDetail').addEventListener('click', function (e) {
      var closeDetails = e.target.closest('[data-calendar-detail-close]');
      if (closeDetails) { clearCalendarEventDetail(); return; }
      var openCloud = e.target.closest('[data-calendar-open-cloud]');
      if (openCloud) {
        clearCalendarEventDetail();
        openCloudEvent(openCloud.dataset.calendarOpenCloud, openCloud.dataset.calendarOpenHistory || null);
        return;
      }
      var openHistory = e.target.closest('[data-calendar-open-history]');
      if (openHistory) {
        clearCalendarEventDetail();
        openLocalHistoryEvent(openHistory.dataset.calendarOpenHistory);
      }
    });

    [['expOverlay', closeExpense], ['menuOverlay', closeMenu]].forEach(function (pair) {
      $(pair[0]).addEventListener('click', function (e) { if (e.target === this) pair[1](); });
    });
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (state.theme === 'system') applyTheme(); });
    }
  }

  function initCurrencySelect() {
    $('currencyHeader').innerHTML = Object.keys(CURRENCIES).map(function (k) {
      return '<option value="' + k + '">' + CURRENCIES[k].label + '</option>';
    }).join('');
  }
  function initLanguageSelect() {
    $('languageHeader').innerHTML = '<option value="es">ES</option><option value="pt">PT</option><option value="en">EN</option>';
  }

  // ---------- Init ----------
  load();
  loadLocalHistory();
  save();
  initCurrencySelect();
  initLanguageSelect();
  applyTheme();
  bind();
  render();

  // Nube: estado de sesión (si está configurada)
  if (cloudReady()) {
    window.Cloud.getSession().then(function (res) {
      if (res.error) throw res.error;
      var session = res && res.data ? res.data.session : null;
      currentSession = session;
      profileReady = false;
      refreshAccountUI(session);
      if (session) {
        ensureProfileForSession().then(function () {
          if (state.cloudId) startCloudSync();
        }).catch(function () {
          refreshAccountUI(null);
          setSyncStatus(t('profileRepairFailed'), true);
        });
      }
      if (state.tab === 'calendario') loadCalendarEvents();
    }).catch(function () {
      currentSession = null;
      profileReady = false;
      refreshAccountUI(null);
      setSyncStatus(t('authVerifyFailed'), true);
    });
    window.Cloud.onAuth(function (session, event) {
      if (event === 'PASSWORD_RECOVERY') {
        passwordRecoveryMode = true;
        currentSession = session || null;
        profileReady = false;
        cloudAccess = null; cloudAccessReady = false; cloudAccessError = null;
        $('authResetMsg').textContent = '';
        refreshAccountUI(null);
        $('authOverlay').classList.add('open');
        return;
      }
      var hadSession = !!currentSession;
      var sameReadyUser = !!(profileReady && currentSession && session && currentSession.user && session.user && currentSession.user.id === session.user.id);
      if (!sameReadyUser) { cloudAccess = null; cloudAccessReady = false; cloudAccessError = null; }
      currentSession = session || null;
      profileReady = sameReadyUser;
      refreshAccountUI(profileReady ? session : null);
      if (session && profileReady && !passwordRecoveryMode && $('authOverlay').classList.contains('open')) closeAuth();
      if (state.tab === 'calendario') loadCalendarEvents();
      if (session && profileReady && state.cloudId) startCloudSync();
      else if (session && !profileReady) stopCloudSync();
      else if (!session) {
        profileReady = false;
        cloudAccess = null; cloudAccessReady = false; cloudAccessError = null;
        stopCloudSync();
        updateCloudTrialUI();
        if (hadSession) closeAuth();
      }
    });
  } else {
    refreshAccountUI(null);
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
