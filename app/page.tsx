"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type EventItem = {
  id: number;
  date: string;
  time: string;
  title: string;
  notes: string;
  category: string;
};

const MONTHS = [
  { index: 6, name: "Julho" },
  { index: 7, name: "Agosto" },
  { index: 8, name: "Setembro" },
  { index: 9, name: "Outubro" },
  { index: 10, name: "Novembro" },
  { index: 11, name: "Dezembro" },
];
const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const CATEGORY_LABELS: Record<string, string> = {
  rosa: "Pessoal",
  roxo: "Compromisso",
  verde: "Saúde",
  dourado: "Especial",
};

function isoDate(month: number, day: number) {
  return `2026-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function Home() {
  const [month, setMonth] = useState(6);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedDate, setSelectedDate] = useState("2026-07-01");
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [alarmsEnabled, setAlarmsEnabled] = useState(false);

  async function loadEvents() {
    try {
      const response = await fetch("/api/events", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setEvents(await response.json());
    } catch {
      setMessage("Não foi possível carregar a agenda agora.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
    setAlarmsEnabled(localStorage.getItem("eliete-alarms-enabled") === "true");
  }, []);

  function speakAlert(item: EventItem, isTest = false) {
    if (!("speechSynthesis" in window)) {
      setMessage("Este aparelho não oferece leitura por voz.");
      return;
    }
    window.speechSynthesis.cancel();
    const phrase = isTest
      ? "Alarme ativado com sucesso. Eliete, você tem um compromisso hoje: " + item.title
      : "Eliete, você tem um compromisso hoje: " + item.title;
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = "pt-BR";
    utterance.rate = 0.92;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }

  async function enableAlarms() {
    let allowed = true;
    if ("Notification" in window && Notification.permission === "default") {
      allowed = (await Notification.requestPermission()) === "granted";
    } else if ("Notification" in window) {
      allowed = Notification.permission === "granted";
    }
    localStorage.setItem("eliete-alarms-enabled", "true");
    setAlarmsEnabled(true);
    const example = events.find((item) => item.date === selectedDate) || {
      id: 0, date: selectedDate, time: "", title: "seu próximo compromisso", notes: "", category: "rosa",
    };
    speakAlert(example, true);
    setMessage(allowed
      ? "Alarmes e notificações ativados neste aparelho."
      : "Alarme por voz ativado. As notificações visuais não foram permitidas.");
  }

  useEffect(() => {
    if (!alarmsEnabled) return;

    function checkAlarms() {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      events
        .filter((item) => item.date === today && item.time === currentTime)
        .forEach((item) => {
          const alertKey = `eliete-alerted-${item.id}-${today}-${currentTime}`;
          if (localStorage.getItem(alertKey)) return;
          localStorage.setItem(alertKey, "true");
          speakAlert(item);
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Eliete, você tem um compromisso!", {
              body: `${item.time} — ${item.title}${item.notes ? `\n${item.notes}` : ""}`,
              icon: "/favicon.ico",
              tag: `eliete-${item.id}-${today}`,
            });
          }
        });
    }

    checkAlarms();
    const timer = window.setInterval(checkAlarms, 20_000);
    return () => window.clearInterval(timer);
  }, [alarmsEnabled, events]);

  const days = useMemo(() => {
    const count = new Date(2026, month + 1, 0).getDate();
    const first = new Date(2026, month, 1).getDay();
    return [
      ...Array.from({ length: first }, () => null),
      ...Array.from({ length: count }, (_, i) => i + 1),
    ];
  }, [month]);

  const selectedEvents = events
    .filter((item) => item.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  function chooseDate(day: number) {
    setSelectedDate(isoDate(month, day));
  }

  function showNewEvent(day?: number) {
    if (day) chooseDate(day);
    setEditing(null);
    setOpen(true);
  }

  function showEditEvent(item: EventItem) {
    setEditing(item);
    setSelectedDate(item.date);
    setOpen(true);
  }

  function editPin() {
    const saved = localStorage.getItem("eliete-edit-pin");
    if (saved) return saved;
    const entered = window.prompt("Digite o PIN para editar a agenda:") || "";
    if (entered) localStorage.setItem("eliete-edit-pin", entered);
    return entered;
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const data = new FormData(event.currentTarget);
    const payload = {
      id: editing?.id,
      date: data.get("date"),
      time: data.get("time"),
      title: data.get("title"),
      notes: data.get("notes"),
      category: data.get("category"),
    };
    try {
      const response = await fetch("/api/events", {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-agenda-pin": editPin(),
        },
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        localStorage.removeItem("eliete-edit-pin");
        setMessage("PIN incorreto. Tente salvar novamente.");
        return;
      }
      if (!response.ok) throw new Error();
      await loadEvents();
      setOpen(false);
      setMessage("Alterações salvas com sucesso.");
      window.setTimeout(() => setMessage(""), 2500);
    } catch {
      setMessage("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id: number) {
    if (!confirm("Excluir este compromisso?")) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/events?id=${id}`, {
        method: "DELETE",
        headers: { "x-agenda-pin": editPin() },
      });
      if (response.status === 401) {
        localStorage.removeItem("eliete-edit-pin");
        setMessage("PIN incorreto. Tente excluir novamente.");
        return;
      }
      if (!response.ok) throw new Error();
      await loadEvents();
      setOpen(false);
      setMessage("Compromisso excluído.");
    } catch {
      setMessage("Não foi possível excluir.");
    } finally {
      setSaving(false);
    }
  }

  const selectedLabel = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  }).format(new Date(`${selectedDate}T12:00:00`));

  return (
    <main>
      <div className="page-shell">
        <header className="hero">
          <span className="butterfly b1" aria-hidden="true">🦋</span>
          <span className="butterfly b2" aria-hidden="true">🦋</span>
          <div className="eyebrow">PLANEJAMENTO • JULHO A DEZEMBRO 2026</div>
          <h1><span>Eliete</span> agenda semestral</h1>
          <p>Organize compromissos, sonhos e momentos especiais.</p>
          <div className="status-row">
            <div className="save-status"><i /> Salvamento automático ativado</div>
            <button className={`alarm-toggle ${alarmsEnabled ? "enabled" : ""}`} onClick={enableAlarms}>
              <span>{alarmsEnabled ? "🔔" : "🔕"}</span>
              {alarmsEnabled ? "Alarmes ativados" : "Ativar alarmes neste aparelho"}
            </button>
          </div>
        </header>

        <nav className="month-tabs" aria-label="Meses do semestre">
          {MONTHS.map((item) => (
            <button
              key={item.index}
              className={month === item.index ? "active" : ""}
              onClick={() => {
                setMonth(item.index);
                setSelectedDate(isoDate(item.index, 1));
              }}
            >
              {item.name}
            </button>
          ))}
        </nav>

        <section className="workspace">
          <div className="calendar-card">
            <div className="calendar-heading">
              <div>
                <span>2026</span>
                <h2>{MONTHS.find((item) => item.index === month)?.name}</h2>
              </div>
              <button className="add-button desktop-add" onClick={() => showNewEvent()}>
                <b>＋</b> Novo compromisso
              </button>
            </div>
            <div className="weekdays">
              {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="calendar-grid">
              {days.map((day, i) =>
                day ? (
                  <button
                    key={i}
                    className={`${selectedDate === isoDate(month, day) ? "selected" : ""} ${events.some((item) => item.date === isoDate(month, day)) ? "has-event" : ""}`}
                    onClick={() => chooseDate(day)}
                    onDoubleClick={() => showNewEvent(day)}
                    aria-label={`${day} de ${MONTHS.find((item) => item.index === month)?.name}`}
                  >
                    <span>{day}</span>
                    <div className="event-dots">
                      {events.filter((item) => item.date === isoDate(month, day)).slice(0, 3).map((item) => (
                        <i key={item.id} className={item.category} />
                      ))}
                    </div>
                  </button>
                ) : <div key={i} className="empty" />
              )}
            </div>
          </div>

          <aside className="day-panel">
            <div className="day-panel-title">
              <div>
                <small>PROGRAMAÇÃO DO DIA</small>
                <h3>{selectedLabel}</h3>
              </div>
              <span className="mini-butterfly" aria-hidden="true">🦋</span>
            </div>
            {loading ? (
              <p className="empty-state">Carregando compromissos...</p>
            ) : selectedEvents.length ? (
              <div className="event-list">
                {selectedEvents.map((item) => (
                  <button className={`event-card ${item.category}`} key={item.id} onClick={() => showEditEvent(item)}>
                    <time>{item.time || "Dia todo"}</time>
                    <strong>{item.title}</strong>
                    {item.notes && <p>{item.notes}</p>}
                    <span>{CATEGORY_LABELS[item.category] || "Compromisso"} · Toque para editar</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span>✿</span>
                <strong>Seu dia está livre</strong>
                <p>Que tal planejar algo especial?</p>
              </div>
            )}
            <button className="add-button mobile-add" onClick={() => showNewEvent()}>
              <b>＋</b> Adicionar neste dia
            </button>
            <div className="quote">
              “Há um tempo certo para cada propósito debaixo do céu.”
              <small>ECLESIASTES 3:1</small>
            </div>
          </aside>
        </section>
        {message && <div className="toast" role="status">{message}</div>}
      </div>

      {open && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button className="close" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
            <span className="modal-icon">🦋</span>
            <p className="eyebrow">{editing ? "EDITAR PROGRAMAÇÃO" : "NOVA PROGRAMAÇÃO"}</p>
            <h2 id="modal-title">{editing ? "Ajuste seu compromisso" : "O que vamos planejar?"}</h2>
            <form onSubmit={saveEvent}>
              <label>Título
                <input name="title" required maxLength={100} defaultValue={editing?.title} placeholder="Ex.: Consulta, reunião, aniversário..." />
              </label>
              <div className="form-row">
                <label>Data
                  <input name="date" type="date" min="2026-07-01" max="2026-12-31" required defaultValue={editing?.date || selectedDate} />
                </label>
                <label>Horário
                  <input name="time" type="time" defaultValue={editing?.time} />
                </label>
              </div>
              <label>Detalhes
                <textarea name="notes" maxLength={500} defaultValue={editing?.notes} placeholder="Endereço, lembretes ou observações..." />
              </label>
              <label>Categoria
                <select name="category" defaultValue={editing?.category || "rosa"}>
                  <option value="rosa">Pessoal</option>
                  <option value="roxo">Compromisso</option>
                  <option value="verde">Saúde</option>
                  <option value="dourado">Especial</option>
                </select>
              </label>
              <div className="form-actions">
                {editing && <button type="button" className="delete" disabled={saving} onClick={() => deleteEvent(editing.id)}>Excluir</button>}
                <button type="submit" className="save" disabled={saving}>{saving ? "Salvando..." : "Salvar compromisso"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
