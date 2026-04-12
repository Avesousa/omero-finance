 1. Q1 — USD sin convertir: ¿Un ingreso en USD que NO se convierte a ARS suma al balance "disponible" en pesos? ¿O
   solo aparece en el "fondo USD"?
    - USD que no se convierta debe sumar al balance disponible (precio de hoy del dolar * usd disponibles)
    - El fondo de USD es una aclaración de cuanto del disponible es parte de los dolares.

  2. Q2 — Gastos Generales vs Mercado: ¿Tienen páginas separadas (/gastos y /mercado) o se unifican y se diferencia
   solo por el tipo seleccionado en el formulario?
    - Si es un gasto más y no deben estar diferenciados en el formulario/movimientos y en la page de gasto.
    - Se debe manejar en el resumen restando del disponible de mercado cuando se gasta del mercado.
    - Se debe manejar en el resumen restando del disponible de gastos cuando se gasta del gasto.

  3. Q3 — Gastos Propios: ¿Tienen pantalla propia o siempre se cargan desde el Quick Log con el toggle "Personal"?
    - Los gastos propios que se manejen en otra pantalla para tener más ordenado, puede ser con un tab para dividir y verlo, pero si debe visualmente ayudar más facil con los gastos personales y también ver el disponible (esto debe ser como el principal) y el del inicio poder tener un toggle para visualizar el disponible de casa - personales

  4. Q4 — Edición simultánea: Si vos y María cargan un gasto al mismo tiempo desde dispositivos distintos,
  ¿last-write-wins está bien o necesitás algún tipo de merge?
    - Está bien, no debe mergear nada, ya que cada gasto es por separado.

  5. Q5 — Onboarding mobile: ¿La app mobile asume que la cuenta ya existe (creada desde la web) o tiene que poder
  crear el hogar y los usuarios desde cero?
    - Si debe existir el onboarding en mobile.
    - La idea es que sea algo como:
        - Cuenta unicamente personal. Está solo tendría un solo usuario y no tendría división entre otras personas y se hace todo el 100%.
        - Cuenta con gastos en comunes. Está solo tendría n usuarios asociados, y funciona como fue al inicio pensado. La cuenta personal quedaría asociada inmediatamente.
            - Se debe crear una cuenta principal y esa puede invitar a los usuarios que estén asociados.
        - (comming soon) Cuenta organización. Un apartado de organización, esto para tener las cuentas de una organización (emprendimiento, negocio, empresa).
            - Se debe crear una cuenta principal y esa puede invitar a otros socios.
        - (comming soon) Cuenta multiple. Poder tener un neogcio, y una cuenta de gastos comunes.
  6. Q6 — Tipo de cambio offline: Cuando no hay internet, ¿la app mobile usa el último rate conocido (guardado en
  cache) o bloquea el formulario hasta tener conectividad?
    - Utilicemos un rate conocido, y guardarlo en la cache para subirlo cuando tengamos conexión.
  7. Q7 — Templates de Gastos Fijos: ¿Son fijos para siempre o el monto puede variar mes a mes (ej: la luz varía)?
  Si varía, ¿el template guarda el monto "base" y la instancia mensual permite sobrescribirlo?
    - Debe ser fijo, pero puede tener modificaciones, entonces, cada mes se debe precargar pero que pueda sobreescribirlo sin afectar a los meses anteriores