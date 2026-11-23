import os
import pandas as pd
import numpy as np


def generate_sample_csvs(data_dir: str, export_dir: str = None):
    os.makedirs(data_dir, exist_ok=True)
    if export_dir:
        os.makedirs(export_dir, exist_ok=True)

    np.random.seed(2026)

    def build_retencion_df(n_samples: int, seed: int, q4_shift: bool = False):
        rng = np.random.default_rng(seed)
        meses_antiguedad = rng.integers(1, 85, size=n_samples)
        edad_cliente = rng.integers(18, 78, size=n_samples)
        cargo_mensual = np.round(rng.uniform(22.0 if q4_shift else 19.90, 155.0 if q4_shift else 149.90, size=n_samples), 2)
        consumo_datos_gb = np.round(rng.gamma(shape=3.4 if q4_shift else 3.2, scale=19.0 if q4_shift else 18.0, size=n_samples).clip(1.0, 380.0), 2)
        horas_streaming_semanal = np.round(rng.uniform(0.0, 45.0, size=n_samples), 1)
        latencia_promedio_ms = np.round(rng.normal(25.0 if q4_shift else 28.0, 10.5, size=n_samples).clip(5.0, 120.0), 1)
        perdida_paquetes_pct = np.round(rng.exponential(scale=0.60 if q4_shift else 0.65, size=n_samples).clip(0.0, 8.5), 2)
        llamadas_soporte = rng.poisson(lam=1.6 if q4_shift else 1.8, size=n_samples)
        atrasos_pago = rng.poisson(lam=0.65 if q4_shift else 0.7, size=n_samples)
        puntaje_satisfaccion = np.round(rng.normal(7.4 if q4_shift else 7.2, 1.55, size=n_samples).clip(1.0, 10.0), 1)
        dispositivos_conectados = rng.integers(1, 12, size=n_samples)
        tipo_contrato = rng.choice(["Mes a mes", "Un anio", "Dos anios"], size=n_samples, p=[0.48, 0.30, 0.22] if q4_shift else [0.52, 0.28, 0.20])
        servicio_internet = rng.choice(["Fibra Optica", "Inalambrico 5G", "ADSL"], size=n_samples, p=[0.62, 0.26, 0.12] if q4_shift else [0.55, 0.25, 0.20])
        soporte_tecnico = rng.choice(["Si", "No"], size=n_samples, p=[0.46, 0.54] if q4_shift else [0.42, 0.58])
        metodo_pago = rng.choice(
            ["Tarjeta de Credito", "Transferencia Bancaria", "Billetera Digital", "Pago en Efectivo"],
            size=n_samples,
            p=[0.30, 0.25, 0.28, 0.17] if q4_shift else [0.30, 0.25, 0.25, 0.20],
        )
        facturacion_digital = rng.choice(["Si", "No"], size=n_samples, p=[0.72, 0.28] if q4_shift else [0.65, 0.35])
        cargos_totales = np.round(
            np.clip(meses_antiguedad * cargo_mensual * rng.uniform(0.95, 1.05, size=n_samples), 19.90, None), 2
        )

        logit_fuga = (
            -1.35
            + 0.028 * (cargo_mensual - 70.0)
            - 0.042 * (meses_antiguedad - 24.0)
            + 0.52 * llamadas_soporte
            + 0.38 * atrasos_pago
            - 0.48 * (puntaje_satisfaccion - 6.5)
            + 0.25 * perdida_paquetes_pct
            + 0.015 * np.maximum(0, latencia_promedio_ms - 35.0)
            + 1.15 * (tipo_contrato == "Mes a mes")
            - 0.75 * (tipo_contrato == "Dos anios")
            - 0.65 * (soporte_tecnico == "Si")
            + 0.42 * (metodo_pago == "Pago en Efectivo")
            + 0.55 * ((cargo_mensual > 95.0) & (meses_antiguedad < 18))
            + 0.45 * ((llamadas_soporte >= 3) & (puntaje_satisfaccion < 6.0))
        )
        fuga = (rng.random(n_samples) < (1.0 / (1.0 + np.exp(-logit_fuga)))).astype(int)

        df = pd.DataFrame({
            "meses_antiguedad": meses_antiguedad,
            "edad_cliente": edad_cliente,
            "cargo_mensual": cargo_mensual,
            "cargos_totales": cargos_totales,
            "consumo_datos_gb": consumo_datos_gb,
            "horas_streaming_semanal": horas_streaming_semanal,
            "latencia_promedio_ms": latencia_promedio_ms,
            "perdida_paquetes_pct": perdida_paquetes_pct,
            "llamadas_soporte": llamadas_soporte,
            "atrasos_pago": atrasos_pago,
            "puntaje_satisfaccion": puntaje_satisfaccion,
            "dispositivos_conectados": dispositivos_conectados,
            "tipo_contrato": tipo_contrato,
            "servicio_internet": servicio_internet,
            "soporte_tecnico": soporte_tecnico,
            "metodo_pago": metodo_pago,
            "facturacion_digital": facturacion_digital,
            "fuga": fuga,
        })
        for col, rate in [("puntaje_satisfaccion", 0.012), ("latencia_promedio_ms", 0.010)]:
            df.loc[rng.random(n_samples) < rate, col] = np.nan
        return df

    def build_noc_df(n_samples: int, seed: int, regional: bool = False):
        rng = np.random.default_rng(seed)
        temperatura_equipo_c = np.round(rng.normal(51.0 if regional else 48.0, 14.5, size=n_samples).clip(18.0, 96.0), 1)
        uso_cpu_pct = np.round(rng.beta(2.5 if regional else 2.4, 2.1, size=n_samples) * 100.0, 1)
        uso_memoria_pct = np.round(rng.beta(2.6, 2.1, size=n_samples) * 100.0, 1)
        carga_trafico_gbps = np.round(rng.gamma(3.1, 14.0, size=n_samples).clip(2.0, 180.0), 2)
        potencia_optica_dbm = np.round(rng.normal(-17.2 if regional else -16.5, 5.2, size=n_samples).clip(-34.0, -3.0), 2)
        errores_crc_hora = rng.poisson(lam=4.6 if regional else 4.2, size=n_samples)
        reinicios_ultimos_7d = rng.poisson(lam=1.0 if regional else 0.9, size=n_samples)
        humedad_gabinete_pct = np.round(rng.normal(56.0 if regional else 52.0, 15.0, size=n_samples).clip(15.0, 95.0), 1)
        voltaje_fuente_v = np.round(rng.normal(48.0, 2.2, size=n_samples).clip(40.0, 56.0), 2)
        antiguedad_nodo_meses = rng.integers(1, 96, size=n_samples)
        tipo_nodo = rng.choice(["Torre Macro 5G", "OLT Fibra Central", "Router Core MPLS"], size=n_samples, p=[0.45, 0.35, 0.20])
        zona_climatica = rng.choice(["Costa Humeda", "Sierra Seca", "Selva Tropical", "Urbano Controlado"], size=n_samples, p=[0.30, 0.22, 0.18, 0.30])
        respaldo_energia = rng.choice(["UPS + Generador", "Solo Baterias", "Sin Respaldo"], size=n_samples, p=[0.50, 0.38, 0.12])

        stress_index = (
            0.055 * (temperatura_equipo_c - 45.0)
            + 0.032 * (uso_cpu_pct - 50.0)
            + 0.025 * (uso_memoria_pct - 55.0)
            + 0.012 * (carga_trafico_gbps - 40.0)
            + 0.14 * np.maximum(0.0, -potencia_optica_dbm - 19.0)
            + 0.18 * errores_crc_hora
            + 0.55 * reinicios_ultimos_7d
            + 0.22 * np.abs(voltaje_fuente_v - 48.0)
            + 0.015 * (humedad_gabinete_pct - 60.0)
            + 0.55 * (respaldo_energia == "Sin Respaldo")
            + rng.normal(0, 0.45, size=n_samples)
        )
        estado_nodo = np.where(stress_index < 0.85, "Operativo", np.where(stress_index < 2.55, "Degradado", "Falla Critica"))

        return pd.DataFrame({
            "temperatura_equipo_c": temperatura_equipo_c,
            "uso_cpu_pct": uso_cpu_pct,
            "uso_memoria_pct": uso_memoria_pct,
            "carga_trafico_gbps": carga_trafico_gbps,
            "potencia_optica_dbm": potencia_optica_dbm,
            "errores_crc_hora": errores_crc_hora,
            "reinicios_ultimos_7d": reinicios_ultimos_7d,
            "humedad_gabinete_pct": humedad_gabinete_pct,
            "voltaje_fuente_v": voltaje_fuente_v,
            "antiguedad_nodo_meses": antiguedad_nodo_meses,
            "tipo_nodo": tipo_nodo,
            "zona_climatica": zona_climatica,
            "respaldo_energia": respaldo_energia,
            "estado_nodo": estado_nodo,
        })

    def build_fraude_df(n_samples: int, seed: int, roaming_batch: bool = False):
        rng = np.random.default_rng(seed)
        monto_operacion_usd = np.round(rng.lognormal(mean=4.25 if roaming_batch else 4.1, sigma=0.95, size=n_samples).clip(5.0, 2800.0), 2)
        hora_transaccion = rng.integers(0, 24, size=n_samples)
        distancia_ult_ubicacion_km = np.round(rng.exponential(scale=120.0 if roaming_batch else 85.0, size=n_samples).clip(0.0, 4500.0), 1)
        cambios_sim_30d = rng.poisson(lam=0.45 if roaming_batch else 0.35, size=n_samples)
        intentos_fallidos_pin = rng.poisson(lam=0.70 if roaming_batch else 0.65, size=n_samples)
        llamadas_internacionales_24h = rng.poisson(lam=1.8 if roaming_batch else 1.4, size=n_samples)
        edad_linea_meses = rng.integers(1, 96, size=n_samples)
        velocidad_consumo_ratio = np.round(rng.lognormal(mean=0.25, sigma=0.6, size=n_samples).clip(0.1, 12.0), 2)
        canal_operacion = rng.choice(["App Movil", "Portal Web", "Call Center", "Agente Externo"], size=n_samples, p=[0.42, 0.28, 0.15, 0.15])
        pais_destino_riesgo = rng.choice(["Bajo", "Medio", "Alto"], size=n_samples, p=[0.55, 0.28, 0.17] if roaming_batch else [0.65, 0.23, 0.12])
        dispositivo_nuevo = rng.choice(["Si", "No"], size=n_samples, p=[0.28, 0.72] if roaming_batch else [0.24, 0.76])
        verificacion_biometrica = rng.choice(["Si", "No"], size=n_samples, p=[0.64, 0.36] if roaming_batch else [0.68, 0.32])

        logit_fraude = (
            -2.65
            + 0.0022 * (monto_operacion_usd - 180.0)
            + 0.0014 * distancia_ult_ubicacion_km
            + 1.35 * cambios_sim_30d
            + 0.68 * intentos_fallidos_pin
            + 0.26 * llamadas_internacionales_24h
            - 0.022 * edad_linea_meses
            + 0.55 * (velocidad_consumo_ratio - 1.5)
            + 0.85 * ((hora_transaccion >= 1) & (hora_transaccion <= 5))
            + 1.25 * (pais_destino_riesgo == "Alto")
            + 0.45 * (pais_destino_riesgo == "Medio")
            + 0.95 * (dispositivo_nuevo == "Si")
            - 1.05 * (verificacion_biometrica == "Si")
            + 0.55 * (canal_operacion == "Agente Externo")
        )
        fraude = (rng.random(n_samples) < (1.0 / (1.0 + np.exp(-logit_fraude)))).astype(int)

        return pd.DataFrame({
            "monto_operacion_usd": monto_operacion_usd,
            "hora_transaccion": hora_transaccion,
            "distancia_ult_ubicacion_km": distancia_ult_ubicacion_km,
            "cambios_sim_30d": cambios_sim_30d,
            "intentos_fallidos_pin": intentos_fallidos_pin,
            "llamadas_internacionales_24h": llamadas_internacionales_24h,
            "edad_linea_meses": edad_linea_meses,
            "velocidad_consumo_ratio": velocidad_consumo_ratio,
            "canal_operacion": canal_operacion,
            "pais_destino_riesgo": pais_destino_riesgo,
            "dispositivo_nuevo": dispositivo_nuevo,
            "verificacion_biometrica": verificacion_biometrica,
            "fraude": fraude,
        })

    def build_ltv_df(n_samples: int, seed: int, b2b_focus: bool = False):
        rng = np.random.default_rng(seed)
        antiguedad_meses = rng.integers(2, 96, size=n_samples)
        gasto_mensual_usd = np.round(rng.uniform(45.0 if b2b_focus else 25.0, 260.0 if b2b_focus else 240.0, size=n_samples), 2)
        servicios_activos = rng.integers(1, 6, size=n_samples)
        consumo_datos_gb = np.round(rng.gamma(3.5, 22.0, size=n_samples).clip(5.0, 450.0), 1)
        uso_roaming_anual_usd = np.round(rng.exponential(scale=75.0 if b2b_focus else 65.0, size=n_samples).clip(0.0, 900.0), 2)
        referidos_exitosos = rng.poisson(lam=1.1, size=n_samples)
        puntaje_fidelidad = np.round(rng.normal(76.0 if b2b_focus else 74.0, 15.0, size=n_samples).clip(15.0, 100.0), 1)
        upgrades_plan = rng.poisson(lam=0.9 if b2b_focus else 0.8, size=n_samples)
        segmento_cliente = rng.choice(["Residencial", "Profesional", "PYME", "Corporativo"], size=n_samples, p=[0.24, 0.28, 0.28, 0.20] if b2b_focus else [0.44, 0.24, 0.20, 0.12])
        tipo_plan = rng.choice(["Basico", "Avanzado 5G", "Fibra Ultra", "Empresarial Dedicado"], size=n_samples, p=[0.18, 0.30, 0.32, 0.20] if b2b_focus else [0.28, 0.34, 0.26, 0.12])
        canal_adquisicion = rng.choice(["Web Directa", "Tienda Fisica", "Ejecutivo B2B", "Referido"], size=n_samples, p=[0.30, 0.20, 0.32, 0.18] if b2b_focus else [0.35, 0.25, 0.22, 0.18])

        seg_bonus = np.where(
            segmento_cliente == "Corporativo",
            620.0,
            np.where(segmento_cliente == "PYME", 340.0, np.where(segmento_cliente == "Profesional", 140.0, 0.0)),
        )
        plan_mult = np.where(
            tipo_plan == "Empresarial Dedicado",
            1.22,
            np.where(tipo_plan == "Fibra Ultra", 1.12, np.where(tipo_plan == "Avanzado 5G", 1.05, 0.96)),
        )
        valor_anual_usd = np.round(
            np.clip(
                (
                    gasto_mensual_usd * 12.0 * plan_mult
                    + servicios_activos * 85.0
                    + uso_roaming_anual_usd * 0.92
                    + referidos_exitosos * 65.0
                    + upgrades_plan * 110.0
                    + antiguedad_meses * 4.5
                    + (puntaje_fidelidad - 50.0) * 6.2
                    + seg_bonus
                    + rng.normal(0.0, 85.0, size=n_samples)
                ),
                240.0,
                None,
            ),
            2,
        )

        return pd.DataFrame({
            "antiguedad_meses": antiguedad_meses,
            "gasto_mensual_usd": gasto_mensual_usd,
            "servicios_activos": servicios_activos,
            "consumo_datos_gb": consumo_datos_gb,
            "uso_roaming_anual_usd": uso_roaming_anual_usd,
            "referidos_exitosos": referidos_exitosos,
            "puntaje_fidelidad": puntaje_fidelidad,
            "upgrades_plan": upgrades_plan,
            "segmento_cliente": segmento_cliente,
            "tipo_plan": tipo_plan,
            "canal_adquisicion": canal_adquisicion,
            "valor_anual_usd": valor_anual_usd,
        })

    df_ret = build_retencion_df(15000, 2026, False)
    df_ret_q4 = build_retencion_df(5000, 3026, True)
    df_noc = build_noc_df(12000, 2027, False)
    df_noc_reg = build_noc_df(4000, 3027, True)
    df_fraude = build_fraude_df(12000, 2028, False)
    df_fraude_roam = build_fraude_df(4000, 3028, True)
    df_ltv = build_ltv_df(10000, 2029, False)
    df_ltv_b2b = build_ltv_df(4000, 3029, True)

    paths = {
        "retencion": os.path.join(data_dir, "area1_retencion_clientes_15k.csv"),
        "retencion_q4": os.path.join(data_dir, "area1_retencion_q4_5k.csv"),
        "red_noc": os.path.join(data_dir, "area2_fallas_red_noc_12k.csv"),
        "red_noc_regional": os.path.join(data_dir, "area2_noc_regional_4k.csv"),
        "antifraude": os.path.join(data_dir, "area3_antifraude_12k.csv"),
        "antifraude_roaming": os.path.join(data_dir, "area3_antifraude_roaming_4k.csv"),
        "comercial_ltv": os.path.join(data_dir, "area4_valor_cliente_ltv_10k.csv"),
        "comercial_b2b": os.path.join(data_dir, "area4_comercial_b2b_4k.csv"),
    }

    df_ret.to_csv(paths["retencion"], index=False)
    df_ret_q4.to_csv(paths["retencion_q4"], index=False)
    df_noc.to_csv(paths["red_noc"], index=False)
    df_noc_reg.to_csv(paths["red_noc_regional"], index=False)
    df_fraude.to_csv(paths["antifraude"], index=False)
    df_fraude_roam.to_csv(paths["antifraude_roaming"], index=False)
    df_ltv.to_csv(paths["comercial_ltv"], index=False)
    df_ltv_b2b.to_csv(paths["comercial_b2b"], index=False)

    if export_dir:
        for key, p in paths.items():
            pd.read_csv(p).to_csv(os.path.join(export_dir, os.path.basename(p)), index=False)

    paths["churn"] = paths["retencion"]
    paths["credit"] = paths["antifraude"]
    paths["clinical"] = paths["red_noc"]
    return paths
