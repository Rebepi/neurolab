#!/usr/bin/env bash
# Ejecutar como root en AlmaLinux 9, con frontend/dist ya compilado.
set -euo pipefail
source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
test -f "$source_dir/frontend/dist/index.html" || { echo 'Primero compila el frontend.' >&2; exit 1; }
test "$(id -u)" = 0 || { echo 'Ejecutar con sudo.' >&2; exit 1; }
dnf install -y python3.11 python3.11-pip libgomp
id neurolab >/dev/null 2>&1 || useradd --system --home-dir /var/lib/neurolab --shell /sbin/nologin neurolab
install -d -m 755 /opt/neurolab /opt/neurolab/backend /opt/neurolab/frontend
install -d -m 750 -o neurolab -g neurolab /var/lib/neurolab

# No copiar la base local ni incluir un entorno virtual de otro sistema operativo.
systemctl stop neurolab.service 2>/dev/null || true
cp -r "$source_dir/backend/app" /opt/neurolab/backend/
cp "$source_dir/backend/requirements.txt" /opt/neurolab/backend/
# Mantener el directorio instalado ajeno al checkout y a los datos persistentes.
python3.11 -m venv /opt/neurolab/venv
/opt/neurolab/venv/bin/python -m pip install --upgrade pip
/opt/neurolab/venv/bin/python -m pip install -r /opt/neurolab/backend/requirements.txt
install -d /opt/neurolab/frontend/dist
cp -r "$source_dir/frontend/dist/." /opt/neurolab/frontend/dist/
cp "$source_dir/deploy/linux/neurolab.service" /etc/systemd/system/neurolab.service
restorecon -R /opt/neurolab /var/lib/neurolab 2>/dev/null || true
systemctl daemon-reload
systemctl enable --now neurolab.service
if systemctl is-active --quiet firewalld; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --reload
fi
for attempt in $(seq 1 60); do
    if curl --fail --silent http://127.0.0.1/health; then exit 0; fi
    sleep 3
done
journalctl -u neurolab --no-pager -n 60
exit 1
