function getOrCreateSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === 'Clientes') {
      sheet.appendRow(['id', 'name', 'phone']);
    } else if (name === 'Agendamentos') {
      sheet.appendRow(['id', 'type', 'clientId', 'clientName', 'date', 'time', 'price', 'participants', 'recurrenceId']);
    }
  }
  return sheet;
}

function rowToObject(row, headers) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    obj[headers[i]] = row[i];
  }
  return obj;
}

function getSheetData(name) {
  var sheet = getOrCreateSheet(name);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  var headers = data[0];
  var rows = data.slice(1);
  var result = rows.map(function(row) {
    return rowToObject(row, headers);
  });

  // Especial parsings para manter JSON nas colunas
  if (name === 'Agendamentos') {
    result.forEach(function(r) {
      if (r.participants) {
        try {
          r.participants = JSON.parse(r.participants);
        } catch(e) {
          r.participants = [];
        }
      } else {
        r.participants = [];
      }
      r.price = Number(r.price) || 0;
    });
  }

  return result;
}

function processAction(req) {
  if (req.action === 'sync') {
    return {
      clients: getSheetData('Clientes'),
      bookings: getSheetData('Agendamentos')
    };
  }

  if (req.action === 'saveClient') {
    saveRecord('Clientes', req.client, ['id', 'name', 'phone']);
    return { success: true };
  }

  if (req.action === 'deleteClient') {
    deleteRecord('Clientes', req.id);
    return { success: true };
  }

  if (req.action === 'saveBooking') {
    if (req.booking.participants) {
      req.booking.participants = JSON.stringify(req.booking.participants);
    }
    saveRecord('Agendamentos', req.booking, ['id', 'type', 'clientId', 'clientName', 'date', 'time', 'price', 'participants', 'recurrenceId']);
    return { success: true };
  }

  if (req.action === 'saveMultipleBookings') {
    var bookings = req.bookings;
    for (var i = 0; i < bookings.length; i++) {
      if (bookings[i].participants) {
        bookings[i].participants = JSON.stringify(bookings[i].participants);
      }
      saveRecord('Agendamentos', bookings[i], ['id', 'type', 'clientId', 'clientName', 'date', 'time', 'price', 'participants', 'recurrenceId']);
    }
    return { success: true };
  }

  if (req.action === 'deleteBooking') {
    if (req.deleteAllFuture && req.recurrenceId) {
      deleteFutureBookings(req.id, req.recurrenceId);
    } else {
      deleteRecord('Agendamentos', req.id);
    }
    return { success: true };
  }

  return { error: 'Unknown action' };
}

function saveRecord(sheetName, obj, headerCols) {
  var sheet = getOrCreateSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  var idColIndex = 0; // assumindo que 'id' é sempre a primeira coluna (A)
  var rowIndex = -1;

  // Procura se já existe
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === obj.id) {
      rowIndex = i + 1; // 1-indexado para a folha
      break;
    }
  }

  var rowData = headerCols.map(function(col) {
    return obj[col] || '';
  });

  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 1, 1, headerCols.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

function deleteRecord(sheetName, id) {
  var sheet = getOrCreateSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      break; 
      // Se tivermos certeza que só tem 1 ID, podemos dar break; 
      // caso contrário deixamos rodar descendo do max pra 1. Aqui damos break pra otimizar.
    }
  }
}

function deleteFutureBookings(id, recurrenceId) {
  var sheet = getOrCreateSheet('Agendamentos');
  var data = sheet.getDataRange().getValues();
  
  var targetDateStr = null;
  // Localiza a data de início (do ID fornecido)
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      targetDateStr = data[i][4]; // coluna date
      break;
    }
  }

  if (!targetDateStr) return;

  var targetDate = new Date(targetDateStr);
  
  // Apagar de baixo pra cima para evitar bug de deslocamento de índices no deleteRow
  for (var i = data.length - 1; i >= 1; i--) {
    var bId = data[i][0];
    var bRecId = data[i][8]; // coluna recurrenceId
    var bDateStr = data[i][4]; // coluna date
    
    if (bId === id) {
       // O próprio que foi clicado
       sheet.deleteRow(i + 1);
    } else if (bRecId === recurrenceId) {
       // Checa se está no futuro ou mesmo dia
       var bDate = new Date(bDateStr);
       if (bDate >= targetDate) {
         sheet.deleteRow(i + 1);
       }
    }
  }
}


function doGet(e) {
  try {
    var result = processAction({ action: 'sync' });
    var output = JSON.stringify(result);
    return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "error": error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var req = {};
    if (e.postData && e.postData.contents) {
      req = JSON.parse(e.postData.contents);
    }
    var result = processAction(req);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "error": error.toString(), request: e ? e.postData : 'no-postData' })).setMimeType(ContentService.MimeType.JSON);
  }
}
