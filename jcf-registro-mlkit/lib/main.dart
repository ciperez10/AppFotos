import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const JcfRegistroApp());
}

class JcfRegistroApp extends StatelessWidget {
  const JcfRegistroApp({super.key});

  @override
  Widget build(BuildContext context) {
    const sky = Color(0xFF0AAEF3);
    const navy = Color(0xFF0E1F53);
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'JCF Registro',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: sky,
          primary: sky,
          secondary: navy,
        ),
        scaffoldBackgroundColor: const Color(0xFFF3F9FD),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFFD8E8F1)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFFD8E8F1)),
          ),
        ),
      ),
      home: const RegistroPage(),
    );
  }
}

class RegistroPage extends StatefulWidget {
  const RegistroPage({super.key});

  @override
  State<RegistroPage> createState() => _RegistroPageState();
}

class _RegistroPageState extends State<RegistroPage> {
  static const sky = Color(0xFF0AAEF3);
  static const navy = Color(0xFF0E1F53);

  final _picker = ImagePicker();
  final _recognizer = TextRecognizer(script: TextRecognitionScript.latin);

  final _tutor = TextEditingController();
  final _cedula = TextEditingController();
  final _nacimiento = TextEditingController();
  final _sexo = TextEditingController();
  final _telefono = TextEditingController();
  final _comunidad = TextEditingController();
  final _nino = TextEditingController();
  final _edad = TextEditingController();
  final _actividad = TextEditingController(text: 'Actividad JCF');

  bool _consentimiento = false;
  bool _busy = false;
  String _status = 'La fotografía se analiza en el teléfono y no se guarda.';
  List<Map<String, dynamic>> _records = [];

  @override
  void initState() {
    super.initState();
    _loadRecords();
  }

  @override
  void dispose() {
    _recognizer.close();
    for (final controller in [
      _tutor,
      _cedula,
      _nacimiento,
      _sexo,
      _telefono,
      _comunidad,
      _nino,
      _edad,
      _actividad,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<File> _recordsFile() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/jcf_registros.json');
  }

  Future<void> _loadRecords() async {
    try {
      final file = await _recordsFile();
      if (!await file.exists()) return;
      final decoded = jsonDecode(await file.readAsString());
      if (decoded is List && mounted) {
        setState(() {
          _records = decoded.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
        });
      }
    } catch (_) {
      // El formulario debe seguir funcionando aunque el archivo local esté dañado.
    }
  }

  Future<void> _persistRecords() async {
    final file = await _recordsFile();
    await file.writeAsString(jsonEncode(_records), flush: true);
  }

  Future<void> _pickAndRead(ImageSource source) async {
    if (_busy) return;
    final XFile? selected = await _picker.pickImage(
      source: source,
      imageQuality: 100,
      preferredCameraDevice: CameraDevice.rear,
      requestFullMetadata: false,
    );
    if (selected == null) return;

    setState(() {
      _busy = true;
      _status = 'Leyendo la cédula con Google ML Kit…';
    });

    try {
      final input = InputImage.fromFilePath(selected.path);
      final recognized = await _recognizer.processImage(input);
      final parsed = DominicanCedulaParser.parse(recognized);

      _tutor.text = parsed.name;
      _cedula.text = parsed.idNumber;
      _nacimiento.text = parsed.birthDate;
      _sexo.text = parsed.sex;

      final found = [parsed.name, parsed.idNumber, parsed.birthDate]
          .where((value) => value.isNotEmpty)
          .length;
      setState(() {
        _status = found >= 2
            ? 'Lectura completada. Confirma los datos antes de guardar.'
            : 'La foto no se leyó con suficiente claridad. Corrige los campos manualmente.';
      });
    } catch (error) {
      setState(() {
        _status = 'No se pudo leer la imagen. Intenta con buena luz y llena el encuadre con la cédula.';
      });
    } finally {
      await _deleteTemporaryImage(selected.path);
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _deleteTemporaryImage(String path) async {
    try {
      final temp = await getTemporaryDirectory();
      if (path.startsWith(temp.path)) {
        final file = File(path);
        if (await file.exists()) await file.delete();
      }
    } catch (_) {
      // No se conserva ninguna referencia a la imagen dentro de la aplicación.
    }
  }

  Future<void> _saveRecord() async {
    final tutor = _tutor.text.trim();
    final phone = _telefono.text.trim();
    final child = _nino.text.trim();
    if (tutor.isEmpty || phone.isEmpty || child.isEmpty) {
      _message('Completa el nombre del tutor, teléfono y nombre del niño.');
      return;
    }
    if (!_consentimiento) {
      _message('El padre o tutor debe autorizar el registro.');
      return;
    }

    final record = <String, dynamic>{
      'tutor': tutor,
      'cedula': _cedula.text.trim(),
      'fecha_nacimiento_tutor': _nacimiento.text.trim(),
      'sexo_tutor': _sexo.text.trim(),
      'telefono': phone,
      'comunidad': _comunidad.text.trim(),
      'nino': child,
      'edad': _edad.text.trim(),
      'actividad': _actividad.text.trim(),
      'consentimiento': true,
      'registrado_en': DateTime.now().toIso8601String(),
    };

    setState(() => _records.add(record));
    await _persistRecords();
    _nino.clear();
    _edad.clear();
    setState(() => _consentimiento = false);
    _message('Registro guardado únicamente en este dispositivo.');
  }

  void _message(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text)));
  }

  String _csv() {
    const headers = [
      'Tutor',
      'Cedula',
      'Nacimiento tutor',
      'Sexo tutor',
      'Telefono',
      'Comunidad',
      'Niño',
      'Edad',
      'Actividad',
      'Fecha de registro',
    ];
    final rows = <List<String>>[
      headers,
      ..._records.map((r) => [
            '${r['tutor'] ?? ''}',
            '${r['cedula'] ?? ''}',
            '${r['fecha_nacimiento_tutor'] ?? ''}',
            '${r['sexo_tutor'] ?? ''}',
            '${r['telefono'] ?? ''}',
            '${r['comunidad'] ?? ''}',
            '${r['nino'] ?? ''}',
            '${r['edad'] ?? ''}',
            '${r['actividad'] ?? ''}',
            '${r['registrado_en'] ?? ''}',
          ]),
    ];
    String escape(String value) => '"${value.replaceAll('"', '""')}"';
    return rows.map((row) => row.map(escape).join(',')).join('\n');
  }

  Future<void> _copyCsv() async {
    if (_records.isEmpty) {
      _message('Todavía no hay registros.');
      return;
    }
    await Clipboard.setData(ClipboardData(text: _csv()));
    _message('Datos copiados en formato CSV. Puedes pegarlos en Excel o Numbers.');
  }

  Future<void> _deleteAll() async {
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Borrar todos los registros'),
        content: const Text('Esta acción no se puede deshacer.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Borrar')),
        ],
      ),
    );
    if (accepted != true) return;
    setState(() => _records = []);
    await _persistRecords();
    _message('Registros eliminados.');
  }

  String _maskedId(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length != 11) return 'Sin cédula';
    return '***-*******-${digits.substring(10)}';
  }

  Widget _field(String label, TextEditingController controller,
      {TextInputType? keyboard, String? hint}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        keyboardType: keyboard,
        decoration: InputDecoration(labelText: label, hintText: hint),
      ),
    );
  }

  Widget _card({required String title, required Widget child}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFD8E8F1)),
        boxShadow: const [BoxShadow(color: Color(0x0D0E1F53), blurRadius: 18, offset: Offset(0, 8))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: navy)),
        const SizedBox(height: 14),
        child,
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('JCF Registro'),
        backgroundColor: sky,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [sky, Color(0xFF62D0FF)]),
                borderRadius: BorderRadius.circular(22),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Registro offline', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
                  SizedBox(height: 5),
                  Text('Familias beneficiadas', style: TextStyle(color: Colors.white, fontSize: 25, fontWeight: FontWeight.w900)),
                  SizedBox(height: 5),
                  Text('Google ML Kit procesa la cédula dentro del teléfono.', style: TextStyle(color: Colors.white)),
                ],
              ),
            ),
            _card(
              title: '1. Leer cédula dominicana',
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _busy ? null : () => _pickAndRead(ImageSource.camera),
                          icon: const Icon(Icons.photo_camera_outlined),
                          label: const Text('Tomar foto'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _busy ? null : () => _pickAndRead(ImageSource.gallery),
                          icon: const Icon(Icons.photo_library_outlined),
                          label: const Text('Subir foto'),
                        ),
                      ),
                    ],
                  ),
                  if (_busy) const Padding(padding: EdgeInsets.only(top: 14), child: LinearProgressIndicator()),
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(_status, style: const TextStyle(color: Color(0xFF667085), height: 1.4)),
                  ),
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text(
                      'Consejo: coloca la cédula horizontal, completa dentro de la imagen, sin reflejos y con las letras enfocadas.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF667085)),
                    ),
                  ),
                ],
              ),
            ),
            _card(
              title: '2. Padre, madre o tutor',
              child: Column(children: [
                _field('Nombre completo', _tutor),
                _field('Cédula', _cedula, keyboard: TextInputType.number, hint: '000-0000000-0'),
                _field('Fecha de nacimiento', _nacimiento),
                _field('Sexo', _sexo),
                _field('Teléfono', _telefono, keyboard: TextInputType.phone),
                _field('Comunidad o sector', _comunidad),
              ]),
            ),
            _card(
              title: '3. Niño, niña o joven',
              child: Column(children: [
                _field('Nombre completo', _nino),
                _field('Edad', _edad, keyboard: TextInputType.number),
                _field('Actividad', _actividad),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _consentimiento,
                  onChanged: (value) => setState(() => _consentimiento = value ?? false),
                  title: const Text(
                    'El padre o tutor autoriza el registro de estos datos para la participación y seguimiento de actividades de la Fundación JCF.',
                    style: TextStyle(fontSize: 13),
                  ),
                  controlAffinity: ListTileControlAffinity.leading,
                ),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: navy, foregroundColor: Colors.white, padding: const EdgeInsets.all(15)),
                    onPressed: _saveRecord,
                    icon: const Icon(Icons.save_outlined),
                    label: const Text('Guardar registro'),
                  ),
                ),
              ]),
            ),
            _card(
              title: 'Registros en este dispositivo (${_records.length})',
              child: Column(
                children: [
                  if (_records.isEmpty)
                    const Align(alignment: Alignment.centerLeft, child: Text('Todavía no hay registros.', style: TextStyle(color: Color(0xFF667085))))
                  else
                    ..._records.reversed.take(10).map(
                          (r) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const CircleAvatar(child: Icon(Icons.person_outline)),
                            title: Text('${r['nino'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: Text('Tutor: ${r['tutor'] ?? ''}\n${_maskedId('${r['cedula'] ?? ''}')} · ${r['comunidad'] ?? ''}'),
                          ),
                        ),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(child: OutlinedButton.icon(onPressed: _copyCsv, icon: const Icon(Icons.copy_all_outlined), label: const Text('Copiar CSV'))),
                    const SizedBox(width: 10),
                    IconButton(onPressed: _deleteAll, tooltip: 'Borrar todos', icon: const Icon(Icons.delete_outline, color: Colors.red)),
                  ]),
                ],
              ),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'Privacidad: la aplicación no sube ni guarda fotografías. Los datos se conservan localmente hasta que se exporten o eliminen.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Color(0xFF667085)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class CedulaData {
  const CedulaData({
    required this.name,
    required this.idNumber,
    required this.birthDate,
    required this.sex,
  });

  final String name;
  final String idNumber;
  final String birthDate;
  final String sex;
}

class _LineData {
  const _LineData(this.text, this.box);
  final String text;
  final Rect box;
}

class DominicanCedulaParser {
  static const _months =
      'ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE';

  static CedulaData parse(RecognizedText result) {
    final lines = <_LineData>[];
    for (final block in result.blocks) {
      for (final line in block.lines) {
        lines.add(_LineData(line.text.trim(), line.boundingBox));
      }
    }
    lines.sort((a, b) {
      final y = a.box.top.compareTo(b.box.top);
      return y != 0 ? y : a.box.left.compareTo(b.box.left);
    });

    return CedulaData(
      name: _name(lines),
      idNumber: _id(lines),
      birthDate: _dateAfter(lines, 'FECHA DE NACIMIENTO'),
      sex: _sex(lines),
    );
  }

  static String _plain(String value) {
    var text = value.toUpperCase();
    const replacements = {
      'Á': 'A',
      'É': 'E',
      'Í': 'I',
      'Ó': 'O',
      'Ú': 'U',
      'Ü': 'U',
      'Ñ': 'N',
    };
    replacements.forEach((key, value) => text = text.replaceAll(key, value));
    return text.replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  static String _id(List<_LineData> lines) {
    String convert(String value) => value
        .toUpperCase()
        .replaceAll('O', '0')
        .replaceAll('Q', '0')
        .replaceAll('I', '1')
        .replaceAll('L', '1')
        .replaceAll('S', '5')
        .replaceAll('B', '8')
        .replaceAll('Z', '2')
        .replaceAll('G', '6')
        .replaceAll(RegExp(r'[^0-9]'), '');

    final dashed = RegExp(
      r'([0-9OQILSBZG]{3})\s*[-–—]\s*([0-9OQILSBZG]{7})\s*[-–—]\s*([0-9OQILSBZG])',
    );
    final compact = RegExp(r'([0-9OQILSBZG]{11})');

    for (final line in lines) {
      final raw = line.text.toUpperCase();
      final match = dashed.firstMatch(raw) ?? compact.firstMatch(raw);
      if (match == null) continue;
      final digits = convert(match.group(0) ?? '');
      if (digits.length != 11) continue;
      return '${digits.substring(0, 3)}-${digits.substring(3, 10)}-${digits.substring(10)}';
    }
    return '';
  }

  static String _dateAfter(List<_LineData> lines, String label) {
    final date = RegExp(r'\b(\d{1,2})\s+(' + _months + r')\s+(\d{4})\b');
    for (var i = 0; i < lines.length; i++) {
      if (!_plain(lines[i].text).contains(label)) continue;
      for (var j = i; j < lines.length && j <= i + 3; j++) {
        final match = date.firstMatch(_plain(lines[j].text));
        if (match != null) return match.group(0) ?? '';
      }
    }

    for (final line in lines) {
      final normalized = _plain(line.text);
      if (normalized.contains('EXPIR')) continue;
      final match = date.firstMatch(normalized);
      if (match != null) return match.group(0) ?? '';
    }
    return '';
  }

  static String _sex(List<_LineData> lines) {
    final all = lines.map((line) => _plain(line.text)).join(' ');
    final match = RegExp(r'\bSEXO\s*[:.]?\s*([MF])\b').firstMatch(all);
    return match?.group(1) ?? '';
  }

  static String _name(List<_LineData> lines) {
    if (lines.isEmpty) return '';
    final minY = lines.map((e) => e.box.top).reduce((a, b) => a < b ? a : b);
    final maxY = lines.map((e) => e.box.bottom).reduce((a, b) => a > b ? a : b);
    final minX = lines.map((e) => e.box.left).reduce((a, b) => a < b ? a : b);
    final maxX = lines.map((e) => e.box.right).reduce((a, b) => a > b ? a : b);
    final height = (maxY - minY).abs();
    final width = (maxX - minX).abs();

    final excluded = RegExp(
      r'REPUBLICA|DOMINICANA|JUNTA|CENTRAL|ELECTORAL|CEDULA|IDENTIDAD|LUGAR|NACIMIENTO|FECHA|NACIONALIDAD|SEXO|SANGRE|ESTADO|CIVIL|OCUPACION|EXPIRACION|SOLTERO|SOLTERA|CASADO|CASADA|MEDICO|EMPRESARIO|EMPLEADO|PUBLICO|COMERCIANTE',
    );

    final candidates = lines.where((line) {
      final text = _plain(line.text);
      final y = line.box.center.dy;
      final x = line.box.center.dx;
      if (y < minY + height * 0.73) return false;
      if (x > minX + width * 0.72) return false;
      if (excluded.hasMatch(text)) return false;
      if (RegExp(r'\d').hasMatch(text)) return false;
      if (!RegExp(r'^[A-Z .\-]+$').hasMatch(text)) return false;
      final words = text.split(' ').where((part) => part.length >= 2).length;
      return words >= 2 && text.length >= 6;
    }).toList()
      ..sort((a, b) => a.box.top.compareTo(b.box.top));

    final unique = <String>[];
    for (final line in candidates.take(3)) {
      final text = _plain(line.text).replaceAll(RegExp(r'[^A-Z .\-]'), '').trim();
      if (text.isNotEmpty && !unique.contains(text)) unique.add(text);
    }
    return unique.join(' ').replaceAll(RegExp(r'\s+'), ' ').trim();
  }
}
