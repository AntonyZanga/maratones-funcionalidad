<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registro de Atleta - Maratones de Sudeste</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <header>
    <h1>Registro de Nuevo Atleta</h1>
  </header>
  <main>
    <section id="form-registro">
      <form id="registro-form">
        <label for="nombre">Nombre:</label>
        <input type="text" id="nombre" name="nombre" required>
        
        <label for="apellido">Apellido:</label>
        <input type="text" id="apellido" name="apellido" required>
        
        <label for="dni">DNI:</label>
        <input type="text" id="dni" name="dni" required>
        
        <label for="fecha-nacimiento">Fecha de Nacimiento:</label>
        <input type="date" id="fecha-nacimiento" name="fecha-nacimiento" required>
        <!-- Aquí se mostrará la categoría calculada -->
        <p id="categoria-leyenda"></p>
        
        <label for="localidad">Localidad:</label>
        <input type="text" id="localidad" name="localidad" required>
        
        <label for="grupo-running">Grupo de Running:</label>
        <input type="text" id="grupo-running" name="grupo-running" required>
        
        <button type="submit">Registrar Atleta</button>
      </form>
    </section>
  </main>
  <script src="js/registration.js"></script>
</body>
</html>
// Función que calcula la categoría usando la fecha de nacimiento y el año actual.
function calculateCategory(birthDateStr) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const birthDate = new Date(birthDateStr);
  // Calcula la edad que tendrá el participante al finalizar el año
  const ageAtYearEnd = currentYear - birthDate.getFullYear();
  
  // Ejemplo de categorías (ajusta según la lógica requerida)
  if (ageAtYearEnd < 20) {
    return "Menos de 20";
  } else if (ageAtYearEnd >= 20 && ageAtYearEnd <= 24) {
    return "20 a 24";
  } else if (ageAtYearEnd >= 25 && ageAtYearEnd <= 29) {
    return "25 a 29";
  } else if (ageAtYearEnd >= 30 && ageAtYearEnd <= 34) {
    return "30 a 34";
  } else if (ageAtYearEnd >= 35 && ageAtYearEnd <= 39) {
    return "35 a 39";
  } else if (ageAtYearEnd >= 40 && ageAtYearEnd <= 44) {
    return "40 a 44";
  } else if (ageAtYearEnd >= 45 && ageAtYearEnd <= 49) {
    return "45 a 49";
  } else if (ageAtYearEnd >= 50 && ageAtYearEnd <= 54) {
    return "50 a 54";
  } else if (ageAtYearEnd >= 55 && ageAtYearEnd <= 59) {
    return "55 a 59";
  } else if (ageAtYearEnd >= 60 && ageAtYearEnd <= 64) {
    return "60 a 64";
  } else if (ageAtYearEnd >= 65 && ageAtYearEnd <= 69) {
    return "65 a 69";
  } else if (ageAtYearEnd >= 70 && ageAtYearEnd <= 74) {
    return "70 a 74";
  } else if (ageAtYearEnd >= 75 && ageAtYearEnd <= 79) {
    return "75 a 79";
  } else if (ageAtYearEnd >= 80 && ageAtYearEnd <= 84) {
    return "80 a 84";
  } else if (ageAtYearEnd >= 85 && ageAtYearEnd <= 89) {
    return "85 a 89";
  } else {
    return "Categoría no definida";
  }
}

// Actualiza la categoría asignada cuando se selecciona la fecha de nacimiento
document.getElementById("fecha-nacimiento").addEventListener("change", function() {
  const birthDateValue = this.value;
  if (birthDateValue) {
    const categoria = calculateCategory(birthDateValue);
    document.getElementById("categoria-leyenda").textContent = "Categoría asignada: " + categoria;
  }
});
