import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  Animated,
  Dimensions,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase, TABLES } from '../../supabase';
import type { Transaccion, Categoria } from '../../supabase';
import { useRouter } from 'expo-router';
import Swal from 'sweetalert2';
import '../styles/swal.css';

type MaterialIconName = 'attach-money' | 'work' | 'business' | 'card-giftcard' | 'account-balance' | 'savings' | 'more-horiz' | 'add' | 'restaurant' | 'directions-car' | 'movie' | 'build' | 'shopping-cart' | 'person' | 'logout' | 'arrow-upward' | 'arrow-downward' | 'delete';

interface Categoria {
  id: number;
  nombre: string;
  tipo: 'ingreso' | 'egreso';
}

interface CategoriaExtendida extends Categoria {
  icono: MaterialIconName;
  color: string;
  descripcion: string;
}

type TipoTransaccion = 'ingreso' | 'egreso';

type IconosPorCategoria = {
  [key in TipoTransaccion]: {
    [key: string]: MaterialIconName;
  };
};

type ColoresPorCategoria = {
  [key in TipoTransaccion]: {
    [key: string]: string;
  };
};

type DescripcionesPorCategoria = {
  [key in TipoTransaccion]: {
    [key: string]: string;
  };
};

interface TransaccionConCategoria {
  id: number;
  usuario_id: number;
  categoria_id: number;
  monto: number;
  tipo: 'ingreso' | 'egreso';
  fecha: string;
  descripcion?: string;
  categorias: Categoria;
}

// Categorías predefinidas
const CATEGORIAS_DEFAULT = [
  { nombre: 'Salario', tipo: 'ingreso' },
  { nombre: 'Inversiones', tipo: 'ingreso' },
  { nombre: 'Regalos', tipo: 'ingreso' },
  { nombre: 'Freelance', tipo: 'ingreso' },
  { nombre: 'Ahorros', tipo: 'ingreso' },
  { nombre: 'Otros', tipo: 'ingreso' },
  { nombre: 'Comida', tipo: 'egreso' },
  { nombre: 'Transporte', tipo: 'egreso' },
  { nombre: 'Entretenimiento', tipo: 'egreso' },
  { nombre: 'Servicios', tipo: 'egreso' },
  { nombre: 'Compras', tipo: 'egreso' },
  { nombre: 'Otros', tipo: 'egreso' },
];

const mostrarMensaje = async (titulo: string, mensaje: string, tipo: 'success' | 'error' | 'warning' = 'success') => {
  await Swal.fire({
    title: titulo,
    text: mensaje,
    icon: tipo,
    confirmButtonColor: tipo === 'success' ? '#4CAF50' : '#FF6B6B',
    confirmButtonText: 'Aceptar',
    customClass: {
      popup: 'swal2-popup',
      title: 'swal2-title',
      htmlContainer: 'swal2-html-container',
      confirmButton: 'swal2-confirm',
      cancelButton: 'swal2-cancel'
    }
  });
};

const confirmarEliminacion = async (monto: number) => {
  const result = await Swal.fire({
    title: '¿Eliminar transacción?',
    html: `
      <div class="delete-transaction-popup">
        <p>Estás a punto de eliminar una transacción por:</p>
        <p class="amount">$${monto.toFixed(2)}</p>
        <p class="warning-text">Esta acción no se puede deshacer</p>
      </div>
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d32f2f',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    customClass: {
      popup: 'swal2-popup delete-transaction-popup',
      title: 'swal2-title',
      htmlContainer: 'swal2-html-container',
      confirmButton: 'swal2-confirm',
      cancelButton: 'swal2-cancel',
      icon: 'swal2-icon'
    }
  });

  return result.isConfirmed;
};

export default function WelcomeScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoTransaccion>('ingreso');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<Categoria | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [transacciones, setTransacciones] = useState<TransaccionConCategoria[]>([]);
  const [saldo, setSaldo] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [loadingDatos, setLoadingDatos] = useState(true);
  const [animation] = useState(new Animated.Value(0));
  const [menuAnimation] = useState(new Animated.Value(0));
  const [datosIngresos, setDatosIngresos] = useState<{ categoria: string; monto: number; color: string }[]>([]);
  const [datosEgresos, setDatosEgresos] = useState<{ categoria: string; monto: number; color: string }[]>([]);

  // Definir los iconos y colores por tipo
  const iconosPorTipo: { [key: string]: { [key: string]: MaterialIconName } } = {
    ingreso: {
      'Salario': 'work',
      'Inversiones': 'business',
      'Regalos': 'card-giftcard',
      'Freelance': 'attach-money',
      'Ahorros': 'savings',
      'Otros': 'more-horiz'
    },
    egreso: {
      'Comida': 'restaurant',
      'Transporte': 'directions-car',
      'Entretenimiento': 'movie',
      'Servicios': 'build',
      'Compras': 'shopping-cart',
      'Otros': 'more-horiz'
    }
  };

  const coloresPorTipo: { [key: string]: { [key: string]: string } } = {
    ingreso: {
      'Salario': '#4CAF50',
      'Inversiones': '#2196F3',
      'Regalos': '#9C27B0',
      'Freelance': '#FF9800',
      'Ahorros': '#00BCD4',
      'Otros': '#607D8B'
    },
    egreso: {
      'Comida': '#FF6B6B',
      'Transporte': '#4ECDC4',
      'Entretenimiento': '#45B7D1',
      'Servicios': '#96CEB4',
      'Compras': '#D4A5A5',
      'Otros': '#6B717E'
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    if (user) {
      inicializarCategorias();
      cargarDatos();
      obtenerSaldoActual();
    }
  }, [user]);

  const inicializarCategorias = async () => {
    try {
      // Verificar si ya existen categorías
      const { data: categoriasExistentes, error: errorConsulta } = await supabase
        .from(TABLES.CATEGORIAS)
        .select('*');

      if (errorConsulta) throw errorConsulta;

      // Si no hay categorías, insertar las predefinidas
      if (!categoriasExistentes || categoriasExistentes.length === 0) {
        const { error: errorInsercion } = await supabase
          .from(TABLES.CATEGORIAS)
          .insert(CATEGORIAS_DEFAULT);

        if (errorInsercion) throw errorInsercion;
        console.log('Categorías predefinidas insertadas correctamente');
      }
    } catch (error) {
      console.error('Error inicializando categorías:', error);
      await mostrarMensaje('Error', 'No se pudieron inicializar las categorías', 'error');
    }
  };

  const cargarDatos = async () => {
    try {
      setLoadingDatos(true);
      const { data: transacciones, error: transaccionesError } = await supabase
        .from('transacciones')
        .select(`
          *,
          categorias (
            id,
            nombre,
            tipo
          )
        `)
        .eq('usuario_id', user?.id)
        .order('fecha', { ascending: false });

      if (transaccionesError) throw transaccionesError;

      setTransacciones(transacciones || []);

      // Actualizar categorías si es necesario
      const { data: categoriasData, error: categoriasError } = await supabase
        .from('categorias')
        .select('*')
        .order('nombre', { ascending: true });

      if (categoriasError) throw categoriasError;

      setCategorias(categoriasData || []);

    } catch (error) {
      console.error('Error cargando datos:', error);
      await mostrarMensaje('Error', 'No se pudieron cargar los datos', 'error');
    } finally {
      setLoadingDatos(false);
    }
  };

  const obtenerSaldoActual = async () => {
    try {
      // Obtener todas las transacciones del usuario
      const { data: transacciones, error } = await supabase
        .from('transacciones')
        .select('*')
        .eq('usuario_id', user?.id);

      if (error) {
        console.error('Error obteniendo saldo:', error);
        return;
      }

      // Calcular el saldo sumando ingresos y restando egresos
      const nuevoSaldo = transacciones.reduce((acc, trans) => {
        if (trans.tipo === 'ingreso') {
          return acc + trans.monto;
        } else {
          return acc - trans.monto;
        }
      }, 0);

      setSaldo(nuevoSaldo);
    } catch (error) {
      console.error('Error calculando saldo:', error);
    }
  };

  const procesarTransacciones = () => {
    const ingresosPorCategoria: { [key: string]: number } = {};
    const egresosPorCategoria: { [key: string]: number } = {};

    transacciones.forEach(transaccion => {
      const categoria = transaccion.categorias.nombre;
      const monto = transaccion.monto;

      if (transaccion.tipo === 'ingreso') {
        ingresosPorCategoria[categoria] = (ingresosPorCategoria[categoria] || 0) + monto;
      } else {
        egresosPorCategoria[categoria] = (egresosPorCategoria[categoria] || 0) + monto;
      }
    });

    const coloresIngresos = ['#4CAF50', '#81C784', '#A5D6A7', '#C8E6C9', '#E8F5E9'];
    const coloresEgresos = ['#FF6B6B', '#FF8A8A', '#FFA9A9', '#FFC8C8', '#FFE7E7'];

    const datosIngresos = Object.entries(ingresosPorCategoria).map(([categoria, monto], index) => ({
      categoria,
      monto,
      color: coloresIngresos[index % coloresIngresos.length],
    }));

    const datosEgresos = Object.entries(egresosPorCategoria).map(([categoria, monto], index) => ({
      categoria,
      monto,
      color: coloresEgresos[index % coloresEgresos.length],
    }));

    setDatosIngresos(datosIngresos);
    setDatosEgresos(datosEgresos);
  };

  useEffect(() => {
    procesarTransacciones();
  }, [transacciones]);

  const renderGraficoExponencial = (datos: { categoria: string; monto: number; color: string }[], total: number) => {
    const alturaGrafico = 200;
    const anchoGrafico = Dimensions.get('window').width - 64; // Ancho de pantalla menos padding
    const padding = 20;
    const alturaUtil = alturaGrafico - (2 * padding);
    const anchoUtil = anchoGrafico - (2 * padding);

    // Ordenar datos de menor a mayor para efecto exponencial
    const datosOrdenados = [...datos].sort((a, b) => a.monto - b.monto);
    const maxMonto = Math.max(...datosOrdenados.map(d => d.monto));

    // Función para calcular la posición Y exponencial
    const calcularPosicionY = (monto: number) => {
      const factor = Math.log(monto + 1) / Math.log(maxMonto + 1); // +1 para evitar log(0)
      return alturaGrafico - (factor * alturaUtil) - padding;
    };

    return (
      <View style={styles.graficoWrapper}>
        <View style={[styles.graficoExponencial, { width: anchoGrafico, height: alturaGrafico }]}>
          {/* Eje Y */}
          <View style={[styles.ejeY, { height: alturaGrafico }]} />
          
          {/* Eje X */}
          <View style={[styles.ejeX, { width: anchoGrafico, bottom: padding }]} />

          {/* Líneas de datos */}
          {datosOrdenados.map((item, index) => {
            const x = (index + 1) * (anchoUtil / (datosOrdenados.length + 1)) + padding;
            const y = calcularPosicionY(item.monto);

            return (
              <React.Fragment key={index}>
                {/* Línea vertical desde eje X hasta el punto */}
                <View
                  style={[
                    styles.lineaVertical,
                    {
                      height: alturaGrafico - y - padding,
                      left: x,
                      bottom: padding,
                      backgroundColor: item.color,
                    },
                  ]}
                />
                
                {/* Punto de datos */}
                <View
                  style={[
                    styles.puntoDatos,
                    {
                      left: x - 6,
                      top: y - 6,
                      backgroundColor: item.color,
                    },
                  ]}
                />

                {/* Etiqueta de categoría */}
                <Text
                  style={[
                    styles.etiquetaCategoria,
                    {
                      left: x - 40,
                      bottom: 0,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.categoria}
                </Text>
              </React.Fragment>
            );
          })}
        </View>

        {/* Leyenda */}
        <View style={styles.leyendaGrafico}>
          {datosOrdenados.map((item, index) => (
            <View key={index} style={styles.itemLeyenda}>
              <View style={[styles.colorLeyenda, { backgroundColor: item.color }]} />
              <Text style={styles.textoLeyenda}>
                {item.categoria}: ${item.monto.toFixed(2)}
              </Text>
              <Text style={styles.porcentajeLeyenda}>
                ({((item.monto / total) * 100).toFixed(1)}%)
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const handleOpenModal = () => {
    setModalVisible(true);
    Animated.spring(animation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7
    }).start();
  };

  const handleCloseModal = () => {
    Animated.timing(animation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true
    }).start(() => {
      setModalVisible(false);
      setTipoSeleccionado('ingreso');
      setCategoriaSeleccionada(null);
      setMonto('');
      setDescripcion('');
    });
  };

  const agregarTransaccion = async () => {
    if (!monto || !categoriaSeleccionada) {
      await mostrarMensaje('Error', 'Por favor ingresa el monto y selecciona una categoría', 'error');
      return;
    }

    if (isNaN(Number(monto)) || Number(monto) <= 0) {
      await mostrarMensaje('Error', 'Por favor ingresa un monto válido', 'error');
      return;
    }

    const montoNumerico = Number(monto);

    // Validar que no se pueda hacer un egreso mayor al saldo actual
    if (tipoSeleccionado === 'egreso' && montoNumerico > saldo) {
      const mensaje = `No puede realizar este gasto:\n\nMonto del gasto: S/. ${montoNumerico.toFixed(2)}\nSaldo actual: S/. ${saldo.toFixed(2)}\n\nEl monto del gasto es mayor a su saldo disponible.`;
      if (!window.confirm(mensaje)) {
        return;
      }
    }

    try {
      setLoading(true);
      const nuevoSaldo = tipoSeleccionado === 'ingreso' 
        ? saldo + montoNumerico 
        : saldo - montoNumerico;

      // Iniciar transacción
      const { error: transaccionError } = await supabase.rpc('crear_transaccion', {
        p_usuario_id: user?.id,
        p_categoria_id: categoriaSeleccionada.id,
        p_monto: montoNumerico,
        p_tipo: tipoSeleccionado,
        p_descripcion: descripcion || null
      });

      if (transaccionError) throw transaccionError;

      // Primero cerrar el modal
      handleCloseModal();
      
      // Actualizar datos
      await Promise.all([
        cargarDatos(),
        obtenerSaldoActual()
      ]);

      // Mostrar mensaje de éxito después de que todo esté actualizado
      await mostrarMensaje('¡Éxito!', `${tipoSeleccionado === 'ingreso' ? 'Ingreso' : 'Gasto'} agregado correctamente`, 'success');
    } catch (error) {
      console.error('Error agregando transacción:', error);
      await mostrarMensaje('Error', `No se pudo agregar el ${tipoSeleccionado === 'ingreso' ? 'ingreso' : 'gasto'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const eliminarTransaccion = async (usuarioId: number, transaccionId: number, monto: number) => {
    try {
      setLoading(true);
      console.log('Intentando eliminar transacción:', { usuarioId, transaccionId });

      // Verificar que el usuario tenga permiso para eliminar esta transacción
      const { data: transaccion, error: checkError } = await supabase
        .from('transacciones')
        .select('*')
        .eq('id', transaccionId)
        .eq('usuario_id', usuarioId)
        .single();

      if (checkError || !transaccion) {
        console.error('Error verificando permisos:', checkError);
        await mostrarMensaje('Error de permisos', 'No tienes permiso para eliminar esta transacción', 'error');
        return;
      }

      // Llamar a la función RPC para eliminar la transacción
      const { error } = await supabase.rpc('eliminar_transaccion', {
        p_usuario_id: usuarioId,
        p_transaccion_id: transaccionId
      });
  
      if (error) {
        console.error('Error al eliminar transacción:', error);
        await mostrarMensaje('Error', 'No se pudo eliminar la transacción. Intenta nuevamente.', 'error');
        return;
      }
  
      // Actualizar los datos incluyendo el saldo
      await Promise.all([
        cargarDatos(),          // Actualiza las transacciones
        obtenerSaldoActual(),   // Actualiza el saldo
      ]);
      
      await mostrarMensaje('¡Éxito!', 'La transacción ha sido eliminada correctamente', 'success');
    } catch (error) {
      console.error('Error inesperado al eliminar transacción:', error);
      await mostrarMensaje('Error', 'Ocurrió un error al eliminar la transacción', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderTransaccion = ({ item }: { item: TransaccionConCategoria }) => {
    const icono = iconosPorTipo[item.tipo]?.[item.categorias.nombre] || 'more-horiz';
    const color = coloresPorTipo[item.tipo]?.[item.categorias.nombre] || '#607D8B';
    const esIngreso = item.tipo === 'ingreso';
    
    return (
      <View style={styles.transaccionItem}>
        <View style={[styles.transaccionIcono, { backgroundColor: color + '20' }]}>
          <MaterialIcons 
            name={icono}
            size={24} 
            color={color} 
          />
        </View>
        <View style={styles.transaccionInfo}>
          <Text style={styles.transaccionCategoria}>
            {item.categorias.nombre}
          </Text>
          {item.descripcion && (
            <Text style={styles.transaccionDescripcion}>{item.descripcion}</Text>
          )}
          <Text style={styles.transaccionFecha}>
            {new Date(item.fecha).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.transaccionAcciones}>
          <Text style={[
            styles.transaccionMonto, 
            { color: esIngreso ? '#4CAF50' : '#FF6B6B' }
          ]}>
            {esIngreso ? '+' : '-'}${item.monto.toFixed(2)}
          </Text>
          <TouchableOpacity
            style={[styles.deleteButton, { padding: 8 }]}
            onPress={async () => {
              try {
                if (!user?.id) {
                  await mostrarMensaje('Error', 'Usuario no identificado', 'error');
                  return;
                }

                const usuarioId = Number(user.id);
                const transaccionId = item.id;

                if (isNaN(usuarioId)) {
                  await mostrarMensaje('Error', 'Error con el ID del usuario', 'error');
                  return;
                }

                const confirmado = await confirmarEliminacion(item.monto);
                if (confirmado) {
                  await eliminarTransaccion(usuarioId, transaccionId, item.monto);
                }
              } catch (error) {
                console.error('Error en el proceso de eliminación:', error);
                await mostrarMensaje('Error', 'Ocurrió un error al procesar la eliminación', 'error');
              }
            }}
          >
            <MaterialIcons 
              name="delete" 
              size={24} 
              color="#FF6B6B"
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      await mostrarMensaje('Error', 'No se pudo cerrar la sesión', 'error');
    }
  };

  const toggleMenu = () => {
    if (menuVisible) {
      Animated.timing(menuAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setMenuVisible(false));
    } else {
      setMenuVisible(true);
      Animated.spring(menuAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7
      }).start();
    }
  };

  const cargarCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('nombre');

      if (error) throw error;

      if (data) {
        setCategorias(data);
      }
    } catch (error) {
      console.error('Error cargando categorías:', error);
      await mostrarMensaje('Error', 'No se pudieron cargar las categorías', 'error');
    }
  };

  useEffect(() => {
    if (user) {
      cargarCategorias();
      cargarDatos();
      obtenerSaldoActual();
    }
  }, [user]);

  const categoriasFiltradas = categorias.filter(cat => cat.tipo === tipoSeleccionado);
  console.log('Tipo seleccionado:', tipoSeleccionado);
  console.log('Categorías filtradas:', categoriasFiltradas);

  const renderCategoriaItem = ({ item }: { item: Categoria }) => {
    const icono = iconosPorTipo[tipoSeleccionado]?.[item.nombre] || 'more-horiz';
    const color = coloresPorTipo[tipoSeleccionado]?.[item.nombre] || '#607D8B';
    const isSelected = categoriaSeleccionada?.id === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.categoriaItem,
          isSelected && styles.categoriaItemSelected
        ]}
        onPress={() => setCategoriaSeleccionada(item)}
      >
        <View style={[styles.categoriaIcono, { backgroundColor: color + '20' }]}>
          <MaterialIcons name={icono} size={24} color={color} />
        </View>
        <Text style={[
          styles.categoriaNombre,
          isSelected && styles.categoriaNombreSelected
        ]}>
          {item.nombre}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderModalContent = () => {
    return (
      <ScrollView 
        style={styles.modalContent}
        showsVerticalScrollIndicator={true}
        bounces={false}
      >
        <View style={styles.modalInnerContent}>
          <View style={styles.tipoTransaccionContainer}>
            <TouchableOpacity
              style={[
                styles.tipoTransaccionButton,
                tipoSeleccionado === 'ingreso'
                  ? styles.tipoTransaccionButtonIngreso
                  : styles.tipoTransaccionButtonUnselected,
              ]}
              onPress={() => setTipoSeleccionado('ingreso')}
            >
              <MaterialIcons
                name="arrow-upward"
                size={24}
                color={tipoSeleccionado === 'ingreso' ? '#fff' : '#495057'}
              />
              <Text
                style={[
                  styles.tipoTransaccionText,
                  tipoSeleccionado === 'ingreso'
                    ? styles.tipoTransaccionTextSelected
                    : styles.tipoTransaccionTextUnselected,
                ]}
              >
                Ingreso
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tipoTransaccionButton,
                tipoSeleccionado === 'egreso'
                  ? styles.tipoTransaccionButtonEgreso
                  : styles.tipoTransaccionButtonUnselected,
              ]}
              onPress={() => setTipoSeleccionado('egreso')}
            >
              <MaterialIcons
                name="arrow-downward"
                size={24}
                color={tipoSeleccionado === 'egreso' ? '#fff' : '#495057'}
              />
              <Text
                style={[
                  styles.tipoTransaccionText,
                  tipoSeleccionado === 'egreso'
                    ? styles.tipoTransaccionTextSelected
                    : styles.tipoTransaccionTextUnselected,
                ]}
              >
                Egreso
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.categoriasContainer}>
            <Text style={styles.categoriasTitle}>Selecciona una categoría</Text>
            <FlatList
              data={categoriasFiltradas}
              renderItem={renderCategoriaItem}
              keyExtractor={item => item.id.toString()}
              showsVerticalScrollIndicator={false}
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Monto"
            value={monto}
            onChangeText={(text) => {
              setMonto(text);
              // Validar el monto mientras se ingresa
              const montoNumerico = Number(text);
              if (tipoSeleccionado === 'egreso' && !isNaN(montoNumerico) && montoNumerico > saldo) {
                const mensaje = `El gasto que intenta ingresar (S/. ${montoNumerico.toFixed(2)}) es mayor a su saldo actual (S/. ${saldo.toFixed(2)}). \n\n¿Desea continuar ingresando el monto?`;
                if (!window.confirm(mensaje)) {
                  setMonto('');
                }
              }
            }}
            keyboardType="numeric"
          />

          <TextInput
            style={[styles.input, styles.inputDescripcion]}
            placeholder="Descripción (opcional)"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
          />

          <TouchableOpacity
            style={[
              styles.addButton,
              (!monto || !categoriaSeleccionada) && styles.addButtonDisabled,
              { backgroundColor: tipoSeleccionado === 'ingreso' ? '#4CAF50' : '#FF6B6B' }
            ]}
            onPress={agregarTransaccion}
            disabled={loading || !monto || !categoriaSeleccionada}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.addButtonText}>
                Agregar {tipoSeleccionado === 'ingreso' ? 'Ingreso' : 'Gasto'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.welcomeContainer}>
        <Text style={styles.welcomeEmoji}>👋</Text>
        <Text style={styles.welcomeText}>
          ¡Bienvenido, <Text style={styles.userName}>{user?.usuario}</Text>!
        </Text>
        <Text style={styles.welcomeSubtext}>Tu asistente financiero personal</Text>
      </View>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
        </View>
        <View style={styles.saldoContainer}>
          <Text style={styles.saldoLabel}>Saldo actual:</Text>
          <Text style={[styles.saldoMonto, { color: saldo >= 0 ? '#4CAF50' : '#FF6B6B' }]}>
            ${saldo.toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.userButton}
          onPress={toggleMenu}
        >
          <MaterialIcons name="person" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {menuVisible && (
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={toggleMenu}
        >
          <Animated.View
            style={[
              styles.menuContainer,
              {
                transform: [
                  { scale: menuAnimation },
                  {
                    translateY: menuAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  },
                ],
                opacity: menuAnimation,
              },
            ]}
          >
            <View style={styles.menuHeader}>
              <View style={styles.avatarContainer}>
                <MaterialIcons name="person" size={32} color="#4CAF50" />
              </View>
              <Text style={styles.menuName}>{user?.nombre} {user?.apellido}</Text>
              <Text style={styles.menuEmail}>{user?.gmail}</Text>
            </View>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
            >
              <MaterialIcons name="logout" size={24} color="#FFF" />
              <Text style={styles.signOutText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.content}>
        {loadingDatos ? (
          <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
        ) : (
          <View style={styles.graficosContainer}>
            <View style={styles.graficoSeccion}>
              <Text style={styles.tituloGrafico}>Ingresos</Text>
              {datosIngresos.length > 0 ? (
                renderGraficoExponencial(
                  datosIngresos,
                  datosIngresos.reduce((acc, curr) => acc + curr.monto, 0)
                )
              ) : (
                <View style={styles.noDataContainer}>
                  <MaterialIcons name="show-chart" size={48} color="#CCC" />
                  <Text style={styles.noDataText}>No hay datos de ingresos</Text>
                </View>
              )}
            </View>

            <View style={styles.graficoSeccion}>
              <Text style={styles.tituloGrafico}>Egresos</Text>
              {datosEgresos.length > 0 ? (
                renderGraficoExponencial(
                  datosEgresos,
                  datosEgresos.reduce((acc, curr) => acc + curr.monto, 0)
                )
              ) : (
                <View style={styles.noDataContainer}>
                  <MaterialIcons name="show-chart" size={48} color="#CCC" />
                  <Text style={styles.noDataText}>No hay datos de egresos</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <FlatList
          data={transacciones}
          renderItem={renderTransaccion}
          keyExtractor={item => item.id.toString()}
          style={styles.lista}
          contentContainerStyle={styles.listaContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="account-balance-wallet" size={48} color="#CCC" />
              <Text style={styles.emptyText}>No hay transacciones registradas</Text>
              <Text style={styles.emptySubtext}>Toca el botón + para agregar una</Text>
            </View>
          }
        />
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={handleOpenModal}
      >
        <MaterialIcons name="add" size={24} color="#FFF" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                transform: [
                  { scale: animation },
                  { translateY: animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva Transacción</Text>
              <TouchableOpacity 
                onPress={handleCloseModal}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {renderModalContent()}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  welcomeContainer: {
    backgroundColor: '#B39DDB', // Soft pastel purple
    padding: 20,
    borderRadius: 15,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  welcomeEmoji: {
    fontSize: 40,
    marginBottom: 10,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#4A148C', // Darker purple for better contrast
    textAlign: 'center',
    marginBottom: 5,
  },
  userName: {
    fontWeight: '800',
    color: '#4A148C', // Matching dark purple
  },
  welcomeSubtext: {
    fontSize: 16,
    color: '#5E35B1', // Medium purple for subtitle
    textAlign: 'center',
    fontStyle: 'italic',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1000,
  },
  headerLeft: {
    flex: 1,
  },
  userButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  menuOverlay: {
    position: 'absolute',
    top: 60, 
    right: 16,
    left: 16,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  menuContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: 280,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuHeader: {
    marginBottom: 24,
    alignItems: 'center',
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  menuName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  menuEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  signOutButton: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
  },
  saldoContainer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  saldoLabel: {
    fontSize: 16,
    color: '#666',
    marginRight: 8,
  },
  saldoMonto: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lista: {
    flex: 1,
  },
  listaContent: {
    padding: 16,
  },
  transaccionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  transaccionIcono: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  transaccionInfo: {
    flex: 1,
  },
  transaccionCategoria: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  transaccionDescripcion: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  transaccionFecha: {
    fontSize: 12,
    color: '#999',
  },
  transaccionAcciones: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transaccionMonto: {
    fontSize: 18,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '90%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 8,
    marginRight: -8,
  },
  tipoTransaccionContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  tipoTransaccionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
  },
  tipoTransaccionButtonIngreso: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  tipoTransaccionButtonEgreso: {
    backgroundColor: '#FF4444',
    borderColor: '#FF4444',
  },
  tipoTransaccionButtonUnselected: {
    backgroundColor: '#fff',
    borderColor: '#dee2e6',
  },
  tipoTransaccionText: {
    fontSize: 16,
    marginLeft: 8,
  },
  tipoTransaccionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  tipoTransaccionTextUnselected: {
    color: '#495057',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalInnerContent: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  categoriasContainer: {
    marginTop: 16,
  },
  categoriasTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
  },
  categoriaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  categoriaItemSelected: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  categoriaIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoriaNombre: {
    fontSize: 16,
    color: '#495057',
    flex: 1,
  },
  categoriaNombreSelected: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    fontSize: 16,
    color: '#333',
  },
  inputDescripcion: {
    height: 100,
    textAlignVertical: 'top',
  },
  addButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  graficosContainer: {
    paddingVertical: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  graficoSeccion: {
    marginBottom: 24,
  },
  tituloGrafico: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  graficoWrapper: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  graficoExponencial: {
    position: 'relative',
    marginBottom: 24,
    backgroundColor: '#fff',
  },
  ejeX: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  ejeY: {
    position: 'absolute',
    width: 1,
    backgroundColor: '#e0e0e0',
    left: 20,
  },
  lineaVertical: {
    position: 'absolute',
    width: 2,
    opacity: 0.7,
  },
  puntoDatos: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  etiquetaCategoria: {
    position: 'absolute',
    width: 80,
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    transform: [{ rotate: '-45deg' }],
  },
  leyendaGrafico: {
    width: '100%',
  },
  itemLeyenda: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  colorLeyenda: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  textoLeyenda: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  porcentajeLeyenda: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  content: {
    flex: 1,
  },
});
