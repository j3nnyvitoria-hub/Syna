

const SUPABASE_URL = "https://bepocqfohmkrrdzmowrv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_PHXFNYdmHo5i8sRdxi23Hg_KsjbwCz3";
const LEGACY_USERS_KEY = "SYNA_USERS";
const LOCAL_DATA_PREFIX = "SYNA_LOCAL_DATA_";
const TERMS_VERSION = "1.0";

let supabaseClient = null;
let currentUser = null;
let activeTimer = null;

function localDataKey(userId) {
    return LOCAL_DATA_PREFIX + userId;
}

function saveCurrentUser() {
    if (!currentUser?.id) return;
    try {
        // Diário, humor, missões e progresso ficam somente neste aparelho/navegador.
        localStorage.setItem(localDataKey(currentUser.id), JSON.stringify(currentUser));
    } catch (error) {
        console.error("Não foi possível salvar os dados locais:", error);
        showToast("Não foi possível salvar neste aparelho. Verifique o espaço disponível.");
    }
}

function migrateLegacyLocalData(authUser) {
    // Migra os dados antigos deste e-mail para a nova conta, sem enviar nada à nuvem.
    try {
        const legacyUsers = JSON.parse(localStorage.getItem(LEGACY_USERS_KEY) || "[]");
        const email = (authUser.email || "").toLowerCase();
        const legacy = legacyUsers.find(user => (user.email || "").toLowerCase() === email);
        const key = localDataKey(authUser.id);
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(key) || "null"); } catch {}

        if (!saved && legacy) {
            const { password, email: oldEmail, name, ...oldData } = legacy;
            saved = {
                ...oldData,
                id: authUser.id,
                email: authUser.email,
                name: name || authUser.user_metadata?.name || email.split("@")[0]
            };
            localStorage.setItem(key, JSON.stringify(saved));
        }

        if (legacy) {
            const remaining = legacyUsers.filter(user => (user.email || "").toLowerCase() !== email);
            if (remaining.length) localStorage.setItem(LEGACY_USERS_KEY, JSON.stringify(remaining));
            else localStorage.removeItem(LEGACY_USERS_KEY);
        }
    } catch (error) {
        console.warn("Não foi possível migrar os dados locais antigos:", error);
    }
}

function loadLocalUser(authUser) {
    migrateLegacyLocalData(authUser);
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(localDataKey(authUser.id)) || "null");
    } catch (error) {
        console.warn("Dados locais inválidos:", error);
    }

    const defaultName = authUser.user_metadata?.name || authUser.user_metadata?.full_name || (authUser.email || "Pessoa").split("@")[0];
    currentUser = prepareUser({
        ...(saved || {}),
        id: authUser.id,
        email: authUser.email,
        name: saved?.name || defaultName
    });
    saveCurrentUser();
    return currentUser;
}


function getToday() {

    const date = new Date();

    return date.toISOString().split("T")[0];

}


function formatDate(date = new Date()) {

    return new Intl.DateTimeFormat(
        "pt-BR",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    ).format(date);

}


function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}


function showToast(message) {

    const toast = document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(window.toastTimer);

    window.toastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 2800);

}


/* =========================================================
   USUÁRIO
========================================================= */

function prepareUser(user) {

    if (!user.diary) user.diary = [];

    if (!user.moods) user.moods = [];

    if (!user.reflections) user.reflections = [];

    if (!user.connectionHistory) user.connectionHistory = [];

    if (!user.gameHistory) user.gameHistory = [];

    if (!user.offlineSessions) user.offlineSessions = [];

    if (!user.exploreStats) {

        user.exploreStats = {

            breathing: 0,
            relax: 0,
            creative: 0,
            offlineMinutes: 0

        };

    }

    if (!user.completedMissions) {

        user.completedMissions = [];

    }

    if (!user.xp) user.xp = 0;

    if (!user.streak) user.streak = 0;

    if (!user.lastActivity) user.lastActivity = null;
    if (typeof user.profilePhoto !== "string") user.profilePhoto = "";
    if (typeof user.theme !== "string") user.theme = "light";
    if (!user.focusSession) user.focusSession = null;

    return user;

}


/* =========================================================
   SPLASH
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    setTimeout(() => {

        const splash = document.getElementById("splash");

        if (splash) {

            splash.classList.add("hidden");

        }

        startApp();

    }, 1700);

    setupEvents();

    loadDailyPhrase();

});


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

async function startApp() {
    try {
        if (!window.supabase?.createClient) {
            throw new Error("A biblioteca do Supabase não carregou.");
        }
        if (!supabaseClient) {
            supabaseClient = window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_PUBLISHABLE_KEY,
                { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
            );
        }

        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;

        if (!session) {
            currentUser = null;
            showScreen("loginScreen");
            return;
        }

        loadLocalUser(session.user);
        showApp();
    } catch (error) {
        console.error("Erro ao iniciar o SYNA:", error);
        showScreen("loginScreen");
        showToast("Não foi possível conectar ao SYNA. Confira sua internet e tente novamente.");
    }
}

function showScreen(id) {

    document.querySelectorAll(".screen").forEach(screen => {

        screen.classList.add("hidden");

    });

    const element = document.getElementById(id);

    if (element) {

        element.classList.remove("hidden");

    }

}


/* =========================================================
   EVENTOS PRINCIPAIS
========================================================= */

function setupEvents() {
document.querySelectorAll(".explore-card").forEach(card => {
   card.addEventListener("click", function () {
       const type = this.dataset.explore;
       openExplore(type);
   });
});

    /* LOGIN */

    const loginForm = document.getElementById("loginForm");

    if (loginForm) {

        loginForm.addEventListener("submit", event => {

            event.preventDefault();

            login();

        });

    }


    /* CADASTRO */

    const registerForm = document.getElementById("registerForm");

    if (registerForm) {

        registerForm.addEventListener("submit", event => {

            event.preventDefault();

            createAccount();

        });

    }


    document.getElementById("goRegister")?.addEventListener(
        "click",
        () => showScreen("registerScreen")
    );


    document.getElementById("backToLogin")?.addEventListener(
        "click",
        () => showScreen("loginScreen")
    );

    document.getElementById("openTerms")?.addEventListener("click", event => {
        event.preventDefault();
        openTerms();
    });


    document.getElementById("forgotPassword")?.addEventListener(
        "click",
        recoverPassword
    );


    document.getElementById("showLoginPassword")?.addEventListener(
        "click",
        () => togglePassword("loginPassword")
    );


    document.getElementById("showRegisterPassword")?.addEventListener(
        "click",
        () => togglePassword("registerPassword")
    );


    /* =====================================================
       NAVEGAÇÃO
    ===================================================== */

    document.querySelectorAll("[data-page]").forEach(button => {

        button.addEventListener("click", event => {

            event.preventDefault();

            const page = button.dataset.page;

            if (isFocusActive()) { showToast("Finalize o Modo Foco antes de navegar pelo SYNA."); return; }
            if (page) {

                openPage(page);

            }

        });

    });


    /* =====================================================
       HUMOR
    ===================================================== */

    document.querySelectorAll(".mood-button").forEach(button => {

        button.addEventListener("click", () => {

            saveMood(button.dataset.mood);

        });

    });


    /* =====================================================
       DIÁRIO
    ===================================================== */

    document.getElementById("saveDiaryButton")?.addEventListener(
        "click",
        saveDiary
    );


    /* =====================================================
       MODAL
    ===================================================== */

    document.getElementById("closeExploreModal")?.addEventListener(
        "click",
        closeExploreModal
    );


    document.getElementById("modalOverlay")?.addEventListener(
        "click",
        closeExploreModal
    );


    /*
       IMPORTANTE:

       Aqui usamos delegação de eventos.

       Isso faz com que botões criados dinamicamente
       dentro dos jogos e atividades também funcionem.
    */

    document.getElementById("modalContent")?.addEventListener(
        "click",
        handleModalClick
    );


    /* =====================================================
       PERFIL
    ===================================================== */

    document.getElementById("logoutButton")?.addEventListener(
        "click",
        logout
    );

    document.getElementById("editProfileButton")?.addEventListener(
        "click",
        editProfile
    );

    document.getElementById("changePasswordButton")?.addEventListener(
        "click",
        changePassword
    );

    document.getElementById("achievementsButton")?.addEventListener(
        "click",
        showAchievements
    );

    document.getElementById("photoProfileButton")?.addEventListener("click", () => document.getElementById("profilePhotoInput")?.click());
    document.getElementById("profilePhotoInput")?.addEventListener("change", handleProfilePhoto);
    document.getElementById("themeToggleButton")?.addEventListener("click", toggleTheme);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshFocusSession(); });

}


/* =========================================================
   CONTA
========================================================= */

async function createAccount() {
    const name = document.getElementById("registerName")?.value.trim() || "";
    const email = document.getElementById("registerEmail").value.trim().toLowerCase();
    const password = document.getElementById("registerPassword").value;
    const password2 = document.getElementById("registerPassword2").value;

    if (!name) {
        showToast("Digite seu nome.");
        return;
    }
    if (!email) {
        showToast("Digite seu e-mail.");
        return;
    }
    if (password !== password2) {
        showToast("As senhas não são iguais.");
        return;
    }
    if (password.length < 6) {
        showToast("A senha precisa ter pelo menos 6 caracteres.");
        return;
    }
    if (!document.getElementById("terms")?.checked) {
        showToast("Você precisa ler e aceitar os termos de uso.");
        return;
    }
    if (!supabaseClient) {
   showToast("Conexão com o servidor não inicializada. Recarregue a página e tente novamente.");
   await startApp();
   if (!supabaseClient) return;
}

    try {
        const acceptedAt = new Date().toISOString();
       
const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
        emailRedirectTo: "https://j3nnyvitoria-hub.github.io/Syna/",
        data: {
            name,
            terms_accepted: true,
            terms_accepted_at: acceptedAt,
            terms_version: TERMS_VERSION
        }
    }
});

        if (error) throw error;

        if (data.session && data.user) {
            loadLocalUser(data.user);
            showToast("Conta criada! Seus dados pessoais ficam salvos somente neste aparelho.");
            setTimeout(showApp, 500);
        } else {
            showToast("Enviamos um link de confirmação para seu e-mail. Confirme para ativar sua conta e depois faça login.");
            showScreen("loginScreen");
        }
    } catch (error) {
        console.error("Erro no cadastro:", error);
        const msg = error.message || "Não foi possível criar sua conta.";
        showToast(msg.toLowerCase().includes("already registered") ? "Este e-mail já possui uma conta. Faça login." : msg);
    }
}

async function login() {
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;

        loadLocalUser(data.user);
        showToast("Login realizado! Seus dados deste aparelho foram carregados.");
        setTimeout(showApp, 400);
    } catch (error) {
        console.error("Erro no login:", error);
        showToast(error.message?.toLowerCase().includes("email not confirmed")
            ? "Confirme seu e-mail antes de entrar."
            : "E-mail ou senha incorretos, ou não foi possível conectar.");
    }
}

async function recoverPassword() {
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    if (!email) {
        showToast("Digite seu e-mail primeiro.");
        return;
    }
    try {
        const redirectTo = window.location.origin + window.location.pathname;
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        showToast("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
    } catch (error) {
        console.error("Erro ao recuperar senha:", error);
        showToast("Não foi possível enviar o e-mail de recuperação. Tente novamente.");
    }
}

function openTerms() {
    const content = `
        <div class="terms-content">
            <h2>Termos de Uso do SYNA</h2>
            <p><strong>Versão 1.0 — 30 de outubro de 2026</strong></p>
            <h3>1. Sobre o SYNA</h3>
            <p>O SYNA é um projeto de apoio ao equilíbrio entre a vida digital e a vida real, com atividades de reflexão, criatividade, respiração e incentivo a conexões fora das telas.</p>
            <h3>2. Cadastro e acesso</h3>
            <p>Para criar uma conta, a pessoa informa um endereço de e-mail válido e define uma senha. O Supabase utiliza esses dados para autenticar o acesso. A pessoa é responsável por manter sua senha em sigilo.</p>
            <h3>3. Aceitação dos termos</h3>
            <p>Ao marcar a caixa de aceitação e criar a conta, a pessoa declara que leu e concorda com estes termos. O SYNA registra na conta a confirmação, a data e a versão dos termos aceitos.</p>
            <h3>4. Dados e privacidade</h3>
            <p>O cadastro na nuvem guarda os dados necessários para autenticação (e-mail) e o registro de aceitação destes termos. O diário, os registros de humor, as atividades e o progresso não são enviados ao Supabase: ficam armazenados localmente no navegador e aparelho utilizados.</p>
            <p>Por isso, esses registros pessoais não são sincronizados entre aparelhos. Limpar os dados do navegador, desinstalar o aplicativo ou trocar de aparelho pode apagar ou impedir o acesso aos registros locais.</p>
            <h3>5. Uso responsável</h3>
            <p>O SYNA tem finalidade educativa e de bem-estar geral. Não é serviço médico, psicológico ou de emergência e não substitui orientação de profissionais qualificados.</p>
            <h3>6. Segurança</h3>
            <p>As senhas são gerenciadas pelo serviço de autenticação do Supabase e não são armazenadas pelo SYNA em texto aberto. A pessoa deve evitar compartilhar suas credenciais.</p>
            <h3>7. Atualizações</h3>
            <p>Estes termos podem ser atualizados para refletir mudanças no funcionamento do SYNA. Quando houver uma alteração relevante, a versão atualizada será apresentada para nova aceitação.</p>
            <h3>8. Contato</h3>
            <p>Em caso de dúvidas sobre o projeto, utilize o canal de contato disponibilizado pela equipe responsável pelo SYNA.</p>
            <button type="button" class="primary-button" id="closeTermsButton">Voltar ao cadastro</button>
        </div>`;
    openSimpleModal(content);
    document.getElementById("closeTermsButton")?.addEventListener("click", closeExploreModal);
}

function togglePassword(id) {

    const input = document.getElementById(id);

    if (!input) return;

    input.type =
        input.type === "password"
            ? "text"
            : "password";

}


/* =========================================================
   APP
========================================================= */

function showApp() {

    document.querySelectorAll(".screen").forEach(screen => {

        screen.classList.add("hidden");

    });

    document.getElementById("appScreen")
        ?.classList.remove("hidden");


    loadUser();

    openPage("home");

    loadDailyPhrase();

    loadMissions();
    if (isFocusActive()) showFocusScreen();
    refreshFocusSession();

}


function loadUser() {

    if (!currentUser) return;

    currentUser = prepareUser(currentUser);


    const firstName =
        currentUser.name.split(" ")[0];


    document.getElementById("userName").textContent =
        firstName;


    document.getElementById("headerInitial").textContent =
        firstName.charAt(0).toUpperCase();


    document.getElementById("profileInitial").textContent =
        firstName.charAt(0).toUpperCase();


    document.getElementById("profileDisplayName").textContent =
        currentUser.name;


    document.getElementById("profileDisplayEmail").textContent =
        currentUser.email;

    applyTheme();
    renderProfilePhoto();
    updateThemeButton();


    updateProfileStats();

    loadMood();

    loadDiary();

}


function openPage(page) {

    const pageMap = {

        home: "homePage",
        diary: "diaryPage",
        missions: "missionsPage",
        explore: "explorePage",
        profile: "profilePage"

    };


    Object.values(pageMap).forEach(id => {

        document.getElementById(id)
            ?.classList.add("hidden");

    });


    const selected = pageMap[page];

    if (!selected) return;


    document.getElementById(selected)
        ?.classList.remove("hidden");


    document.querySelectorAll(".nav-button").forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.page === page
        );

    });


    if (page === "missions") {

        loadMissions();

    }


    if (page === "profile") {

        updateProfileStats();

    }

}


/* =========================================================
   FRASE DO DIA
========================================================= */

const dailyPhrases = [

    "Você não precisa estar bem o tempo todo. Só precisa continuar cuidando de você.",

    "Às vezes, o melhor lugar para estar é exatamente onde você está.",

    "Desconectar da tela também é uma forma de se conectar com a vida.",

    "Pequenos momentos reais podem se tornar grandes memórias.",

    "Hoje, tente trocar alguns minutos de tela por alguns minutos de presença.",

    "Você merece viver experiências que não cabem em uma tela.",

    "Nem tudo precisa ser registrado. Algumas coisas só precisam ser vividas.",

    "Converse. Ria. Saia. Esteja presente. A vida acontece fora da tela.",

    "Seu celular pode guardar memórias, mas quem cria as memórias é você."

];


function loadDailyPhrase() {

    const element =
        document.getElementById("dailyPhrase");

    if (!element) return;


    const dayNumber =
        Math.floor(
            new Date().getTime() /
            (1000 * 60 * 60 * 24)
        );


    const phrase =
        dailyPhrases[
            dayNumber % dailyPhrases.length
        ];


    element.textContent = phrase;

}


const moodMessages = {

    bem: [
        "Que bom perceber isso. Aproveite esse momento e faça algo que torne seu dia ainda melhor. 💜",
        "Você está bem hoje. Que tal transformar esse sentimento em uma memória boa?",
        "Continue aproveitando seu momento. A vida também é feita desses dias leves."
    ],

    meio: [
        "Nem todo dia precisa ser incrível. Vá no seu ritmo e dê espaço para você.",
        "Talvez hoje seja um bom dia para diminuir o ritmo e fazer algo que te faça bem.",
        "Você não precisa resolver tudo agora. Um pequeno passo já conta."
    ],

    mal: [
        "Sinto muito que hoje esteja difícil. Não precisa carregar tudo sozinho. Converse com alguém de confiança.",
        "Hoje pode estar pesado, mas esse momento não define todos os seus dias.",
        "Se puder, pare um pouco. Respire. Procure alguém que faça você se sentir acolhido."
    ]

};


function saveMood(mood) {

    const messageList =
        moodMessages[mood];

    const message =
        messageList[
            Math.floor(
                Math.random() * messageList.length
            )
        ];


    currentUser.moods.push({

        mood,
        date: new Date().toISOString()

    });


    saveCurrentUser();


    document.getElementById("moodResult").innerHTML = `

        <strong>
            ${getMoodName(mood)}
        </strong>

        <br>

        ${message}

    `;


    addXP(5);

}


function getMoodName(mood) {

    if (mood === "bem") return "Você registrou: Bem 😊";

    if (mood === "meio") return "Você registrou: Meio termo 😐";

    return "Você registrou: Mal 😔";

}


function loadMood() {

    const result =
        document.getElementById("moodResult");

    if (!result || !currentUser) return;


    const last =
        currentUser.moods[
            currentUser.moods.length - 1
        ];


    if (!last) return;


    result.innerHTML = `

        <strong>
            ${getMoodName(last.mood)}
        </strong>

        <br>

        Seu momento foi registrado.
        Continue prestando atenção em como você está se sentindo.

    `;

}


/* =========================================================
   DIÁRIO
========================================================= */

function saveDiary() {

    const textarea =
        document.getElementById("diaryText");

    const text =
        textarea.value.trim();


    if (!text) {

        showToast("Escreva alguma coisa antes de salvar.");

        return;

    }


    currentUser.diary.unshift({

        text,
        date: new Date().toISOString()

    });


    saveCurrentUser();


    textarea.value = "";

    loadDiary();

    addXP(10);

    showToast("Seu desabafo foi salvo. 💜");

}


function loadDiary() {

    const container =
        document.getElementById("diaryHistory");

    if (!container || !currentUser) return;


    if (!currentUser.diary.length) {

        container.innerHTML = `

            <div class="option-card">

                <strong>
                    Ainda não há registros.
                </strong>

                <p>
                    Quando quiser colocar algo para fora,
                    escreva aqui.
                </p>

            </div>

        `;

        return;

    }


    container.innerHTML =
        currentUser.diary
            .slice(0, 8)
            .map(entry => `

                <div class="diary-entry">

                    <small>
                        ${formatDate(new Date(entry.date))}
                    </small>

                    <p>
                        ${escapeHTML(entry.text)}
                    </p>

                </div>

            `)
            .join("");

}


/* =========================================================
   MISSÕES
========================================================= */

const missionData = [

    {
        id: "offline20",
        title: "20 minutos sem celular",
        description: "Deixe o celular longe e faça alguma coisa no mundo real.",
        xp: 25
    },

    {
        id: "conversation",
        title: "Converse de verdade",
        description: "Passe pelo menos 10 minutos conversando com alguém sem ficar olhando para a tela.",
        xp: 30
    },

    {
        id: "pause",
        title: "Faça uma pausa",
        description: "Pare por alguns minutos, respire e observe o ambiente ao seu redor.",
        xp: 20
    }

];


function loadMissions() {

    const container =
        document.getElementById("missionsList");

    if (!container || !currentUser) return;


    const completed =
        currentUser.completedMissions;


    container.innerHTML =
        missionData.map(mission => {

            const done =
                completed.includes(mission.id);


            return `

                <div class="mission-card ${done ? "completed" : ""}">

                    <h3>
                        ${mission.title}
                    </h3>

                    <p>
                        ${mission.description}
                    </p>

                    ${
                        done

                        ? `<button disabled>
                                ✓ Concluída
                           </button>`

                        : `<button
                                data-mission="${mission.id}"
                                onclick="completeMission('${mission.id}')"
                           >
                                Concluir +${mission.xp} XP
                           </button>`
                    }

                </div>

            `;

        })
        .join("");


    updateMissionProgress();

}


function completeMission(id) {

    const mission =
        missionData.find(
            item => item.id === id
        );


    if (!mission) return;


    if (
        currentUser.completedMissions.includes(id)
    ) {

        return;

    }


    currentUser.completedMissions.push(id);

    saveCurrentUser();

    addXP(mission.xp);

    updateStreak();

    loadMissions();

    showToast(
        `Missão concluída! +${mission.xp} XP`
    );

}


function updateMissionProgress() {

    const completed =
        currentUser.completedMissions.length;

    const total =
        missionData.length;


    const percent =
        (completed / total) * 100;


    document.getElementById(
        "missionProgressText"
    ).textContent =
        `${completed}/${total}`;


    document.getElementById(
        "missionProgress"
    ).style.width =
        `${percent}%`;

}


/* =========================================================
   XP
========================================================= */

function addXP(amount) {

    if (!currentUser) return;

    currentUser.xp += amount;

    saveCurrentUser();

    updateProfileStats();

}


function getLevel(xp) {

    return Math.floor(xp / 100) + 1;

}


function updateProfileStats() {

    if (!currentUser) return;


    document.getElementById("xpValue").textContent =
        currentUser.xp;


    document.getElementById("levelValue").textContent =
        getLevel(currentUser.xp);


    document.getElementById("streakValue").textContent =
        currentUser.streak;


    document.getElementById("offlineMinutesValue").textContent =
        `${currentUser.exploreStats.offlineMinutes} min`;


    document.getElementById("connectionsValue").textContent =
        currentUser.connectionHistory.length;


    document.getElementById("reflectionsValue").textContent =
        currentUser.reflections.length;


    document.getElementById("creativeValue").textContent =
        currentUser.exploreStats.creative;

}


function updateStreak() {

    const today = getToday();

    if (currentUser.lastActivity !== today) {

        currentUser.streak += 1;

        currentUser.lastActivity = today;

        saveCurrentUser();

    }

}


/* =========================================================
   EXPLORAR
========================================================= */

function openExplore(type) {

    const modal =
        document.getElementById("exploreModal");

    const content =
        document.getElementById("modalContent");


    if (!modal || !content) return;


    content.innerHTML =
        renderExplore(type);


    modal.classList.remove("hidden");

}


function closeExploreModal() {

    if (isFocusActive()) { showToast("Seu Modo Foco ainda está ativo. Aguarde o tempo terminar."); return; }
    stopActiveTimer();

    document.getElementById("exploreModal")
        ?.classList.add("hidden");

}


function renderExplore(type) {

    switch (type) {

        case "focus":
            return renderFocus();

        case "breathing":
            return renderBreathing();

        case "offline":
            return renderOffline();

        case "connections":
            return renderConnections();

        case "games":
            return renderGames();

        case "night":
            return renderNight();

        case "reflection":
            return renderReflection();

        case "creative":
            return renderCreative();

        case "relax":
            return renderRelax();

        default:
            return `

                <h2 class="modal-title">
                    Ops!
                </h2>

                <p class="modal-subtitle">
                    Não encontramos essa experiência.
                </p>

            `;

    }

}


/* =========================================================
   EVENTOS DO MODAL
========================================================= */

function handleModalClick(event) {

    const button =
        event.target.closest("[data-action]");


    if (!button) return;


    const action =
        button.dataset.action;

    if (action === "startFocus") startFocus(Number(button.dataset.minutes));
    if (action === "finishFocus") finishFocus();


    if (action === "startBreathing") {

        startBreathing();

    }


    if (action === "offlineSelect") {

        startOffline(
            Number(button.dataset.minutes)
        );

    }


    if (action === "newReflection") {

        openExplore("reflection");

    }


    if (action === "saveReflection") {

        saveReflection();

    }


    if (action === "newCreative") {

        openExplore("creative");

    }


    if (action === "newNight") {

        openExplore("night");

    }


    if (action === "connectionType") {

        openConnectionCategory(
            button.dataset.type
        );

    }


    if (action === "connectionActivity") {

        startConnectionActivity(
            button.dataset.activity
        );

    }


    if (action === "gameType") {

        startGame(
            button.dataset.game
        );

    }


    if (action === "gameNext") {

        nextGameQuestion();

    }


    if (action === "relaxTechnique") {

        showRelaxTechnique(
            button.dataset.technique
        );

    }


    if (action === "close") {

        closeExploreModal();

    }

}


/* =========================================================
   RESPIRAÇÃO
========================================================= */

function renderBreathing() {

    return `

        <h2 class="modal-title">
            🌬️ Respiração guiada
        </h2>

        <p class="modal-subtitle">
            Reserve alguns minutos para desacelerar.
            O exercício vai guiar sua respiração.
        </p>

        <div class="option-card">

            <strong>
                Como funciona?
            </strong>

            <p>
                Inspire por 4 segundos,
                segure por 4 e expire por 6.
                Repita algumas vezes.
            </p>

        </div>

        <div class="timer" id="activityTimer">
            00
        </div>

        <div class="timer-phase" id="timerPhase">
            Pronto?
        </div>

        <div class="timer-info" id="timerInfo">
            4 ciclos
        </div>

        <button
            class="modal-action"
            data-action="startBreathing"
        >
            Começar
        </button>

    `;

}


function startBreathing() {

    stopActiveTimer();


    let cycle = 1;

    const phases = [

        {
            name: "Inspire",
            seconds: 4
        },

        {
            name: "Segure",
            seconds: 4
        },

        {
            name: "Expire",
            seconds: 6
        }

    ];


    let phaseIndex = 0;

    let remaining =
        phases[0].seconds;


    const timer =
        document.getElementById("activityTimer");

    const phase =
        document.getElementById("timerPhase");

    const info =
        document.getElementById("timerInfo");


    function update() {

        timer.textContent =
            String(remaining).padStart(2, "0");

        phase.textContent =
            phases[phaseIndex].name;

        info.textContent =
            `Ciclo ${cycle} de 4`;

    }


    update();


    activeTimer =
        setInterval(() => {

            remaining--;


            if (remaining <= 0) {

                phaseIndex++;


                if (
                    phaseIndex >= phases.length
                ) {

                    phaseIndex = 0;

                    cycle++;

                }


                if (cycle > 4) {

                    stopActiveTimer();

                    timer.textContent = "✓";

                    phase.textContent =
                        "Exercício concluído";

                    info.textContent =
                        "Você dedicou alguns minutos a você.";

                    currentUser.exploreStats.breathing++;

                    saveCurrentUser();

                    addXP(15);

                    updateStreak();

                    showToast("Respiração concluída! +15 XP");

                    return;

                }


                remaining =
                    phases[phaseIndex].seconds;

            }


            update();

        }, 1000);

}


/* =========================================================
   MODO FOCO — bloqueio interno com término por horário
========================================================= */
function isFocusActive() {
    return !!(currentUser?.focusSession && currentUser.focusSession.endsAt > Date.now());
}

function renderFocus() {
    if (isFocusActive()) {
        return `<h2 class="modal-title">⏳ Modo Foco ativo</h2><p class="modal-subtitle">As outras áreas do SYNA ficam pausadas até o contador chegar a zero.</p><div class="timer" id="focusTimer">--:--</div><div class="timer-phase">Permaneça neste momento.</div><p class="timer-info">Você pode sair do aplicativo, mas não poderá usar as outras áreas do SYNA enquanto a sessão estiver ativa.</p>`;
    }
    return `<h2 class="modal-title">⏳ Modo Foco</h2><p class="modal-subtitle">Escolha um período para se concentrar em uma atividade fora das outras áreas do SYNA.</p><div class="option-card"><strong>Como funciona?</strong><p>Durante a sessão, a navegação interna do SYNA fica bloqueada. O contador continua mesmo se você fechar ou minimizar o aplicativo.</p></div><div class="choice-grid">${[5,10,15,20,30,45].map(m=>`<button class="choice-button" data-action="startFocus" data-minutes="${m}">${m} minutos</button>`).join('')}</div><p class="timer-info">Este recurso não bloqueia outros aplicativos nem impede que o aparelho seja desligado.</p>`;
}

function startFocus(minutes) {
    if (!Number.isFinite(minutes) || minutes < 1 || !currentUser) return;
    currentUser.focusSession = { startedAt: Date.now(), endsAt: Date.now() + minutes * 60000, minutes };
    saveCurrentUser();
    showFocusScreen();
    refreshFocusSession();
    showToast(`Modo Foco iniciado por ${minutes} minutos.`);
}

function showFocusScreen() {
    const modal = document.getElementById('exploreModal');
    const content = document.getElementById('modalContent');
    if (!modal || !content) return;
    content.innerHTML = renderFocus();
    modal.classList.remove('hidden');
}

function refreshFocusSession() {
    if (!currentUser?.focusSession) return;
    const session = currentUser.focusSession;
    const remaining = Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000));
    if (remaining <= 0) {
        currentUser.focusSession = null;
        currentUser.exploreStats.offlineMinutes += session.minutes || 0;
        currentUser.offlineSessions.push({ minutes: session.minutes || 0, date: new Date().toISOString(), type: 'focus' });
        saveCurrentUser();
        const timer = document.getElementById('focusTimer');
        if (timer) timer.textContent = '00:00';
        const content = document.getElementById('modalContent');
        if (content && !document.getElementById('focusComplete')) content.innerHTML = `<div id="focusComplete"><h2 class="modal-title">🎉 Modo Foco concluído!</h2><p class="modal-subtitle">Você reservou ${session.minutes} minutos para estar presente fora das outras áreas do SYNA.</p><button class="modal-action" data-action="finishFocus">Voltar ao SYNA</button></div>`;
        updateProfileStats();
        showToast('Modo Foco concluído!');
        return;
    }
    const timer = document.getElementById('focusTimer');
    if (timer) timer.textContent = `${String(Math.floor(remaining / 60)).padStart(2,'0')}:${String(remaining % 60).padStart(2,'0')}`;
    if (!activeTimer && !document.hidden) activeTimer = setInterval(() => {
        if (!currentUser?.focusSession) { clearInterval(activeTimer); activeTimer = null; return; }
        const left = Math.max(0, Math.ceil((currentUser.focusSession.endsAt - Date.now()) / 1000));
        const el = document.getElementById('focusTimer');
        if (el) el.textContent = `${String(Math.floor(left / 60)).padStart(2,'0')}:${String(left % 60).padStart(2,'0')}`;
        if (left <= 0) { clearInterval(activeTimer); activeTimer = null; refreshFocusSession(); }
    }, 1000);
}

function finishFocus() {
    if (currentUser?.focusSession && currentUser.focusSession.endsAt > Date.now()) return;
    closeFocusModal();
}
function closeFocusModal() {
    document.getElementById('exploreModal')?.classList.add('hidden');
    if (activeTimer) { clearInterval(activeTimer); activeTimer = null; }
}

function handleProfilePhoto(event) {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;
    if (!file.type.startsWith('image/')) { showToast('Escolha uma imagem válida.'); return; }
    if (file.size > 2 * 1024 * 1024) { showToast('Escolha uma foto de até 2 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { currentUser.profilePhoto = String(reader.result); saveCurrentUser(); renderProfilePhoto(); showToast('Foto de perfil atualizada neste aparelho.'); };
    reader.readAsDataURL(file);
}
function renderProfilePhoto() {
    if (!currentUser) return;
    ['profileInitial','headerInitial'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (currentUser.profilePhoto) { el.innerHTML = `<img src="${currentUser.profilePhoto}" alt="Foto de perfil">`; el.classList.add('has-photo'); }
        else { el.textContent = (currentUser.name || 'U').charAt(0).toUpperCase(); el.classList.remove('has-photo'); }
    });
}
function applyTheme() {
    document.documentElement.dataset.theme = currentUser?.theme === 'dark' ? 'dark' : 'light';
}
function updateThemeButton() {
    const button = document.getElementById('themeToggleButton');
    if (button) button.textContent = currentUser?.theme === 'dark' ? '☀️ Ativar tema claro' : '🌙 Ativar tema escuro';
}
function toggleTheme() {
    if (!currentUser) return;
    currentUser.theme = currentUser.theme === 'dark' ? 'light' : 'dark';
    saveCurrentUser(); applyTheme(); updateThemeButton();
}

/* =========================================================
   MOMENTO OFF
========================================================= */

const offlineIdeas = [

    "Prepare uma bebida e tome sem mexer no celular.",

    "Converse com alguém que esteja perto de você.",

    "Coloque uma música e apenas escute.",

    "Faça uma caminhada curta observando o lugar.",

    "Organize um pequeno espaço do seu quarto.",

    "Desenhe alguma coisa sem se preocupar com o resultado.",

    "Prepare um lanche.",

    "Brinque com seu animal de estimação.",

    "Sente em algum lugar e observe o ambiente.",

    "Faça uma atividade manual.",

    "Escreva em um papel três coisas pelas quais você é grato.",

    "Chame alguém para conversar pessoalmente."

];


function renderOffline() {

    return `

        <h2 class="modal-title">
            📵 Momento OFF
        </h2>

        <p class="modal-subtitle">
            Escolha quanto tempo você quer passar
            longe da tela.
        </p>

        <div class="choice-grid">

            <button
                class="choice-button"
                data-action="offlineSelect"
                data-minutes="5"
            >
                5 minutos
            </button>

            <button
                class="choice-button"
                data-action="offlineSelect"
                data-minutes="10"
            >
                10 minutos
            </button>

            <button
                class="choice-button"
                data-action="offlineSelect"
                data-minutes="20"
            >
                20 minutos
            </button>

            <button
                class="choice-button"
                data-action="offlineSelect"
                data-minutes="30"
            >
                30 minutos
            </button>

        </div>

        <div id="offlineArea"></div>

    `;

}


function startOffline(minutes) {

    stopActiveTimer();


    const idea =
        offlineIdeas[
            Math.floor(
                Math.random() * offlineIdeas.length
            )
        ];


    const area =
        document.getElementById("offlineArea");


    area.innerHTML = `

        <div class="option-card">

            <strong>
                Seu desafio:
            </strong>

            <p>
                ${idea}
            </p>

        </div>

        <div class="timer" id="activityTimer">
            ${String(minutes).padStart(2, "0")}:00
        </div>

        <div class="timer-phase">
            Celular OFF
        </div>

        <div class="timer-info" id="timerInfo">
            Quando terminar, volte aqui para registrar.
        </div>

        <button
            class="modal-secondary"
            data-action="close"
        >
            Começar agora e sair do app
        </button>

    `;


    /*
       Para a demonstração do projeto,
       o contador começa e continua mesmo com
       o modal aberto.
    */

    let totalSeconds =
        minutes * 60;


    const timer =
        document.getElementById("activityTimer");


    activeTimer =
        setInterval(() => {

            totalSeconds--;


            const min =
                Math.floor(totalSeconds / 60);

            const sec =
                totalSeconds % 60;


            timer.textContent =
                `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;


            if (totalSeconds <= 0) {

                stopActiveTimer();


                currentUser.exploreStats.offlineMinutes += minutes;

                currentUser.offlineSessions.push({

                    minutes,
                    date: new Date().toISOString()

                });


                saveCurrentUser();

                addXP(10);

                updateStreak();


                area.innerHTML = `

                    <div class="option-card">

                        <strong>
                            🎉 Momento OFF concluído!
                        </strong>

                        <p>
                            Você ficou ${minutes} minutos
                            longe da tela.
                            Isso também é equilíbrio.
                        </p>

                    </div>

                    <button
                        class="modal-action"
                        data-action="close"
                    >
                        Voltar para o SYNA
                    </button>

                `;


                showToast(
                    `Momento OFF concluído! +10 XP`
                );

            }

        }, 1000);

}


/* =========================================================
   CONEXÕES
========================================================= */

function renderConnections() {

    return `

        <h2 class="modal-title">
            🤝 Conexões
        </h2>

        <p class="modal-subtitle">
            Relacionamento não é só casal.
            É família, amizade e pessoas que fazem
            parte da sua vida.
        </p>

        <div class="choice-grid">

            <button
                class="choice-button"
                data-action="connectionType"
                data-type="casal"
            >
                ❤️ Casal
            </button>

            <button
                class="choice-button"
                data-action="connectionType"
                data-type="familia"
            >
                🏠 Família
            </button>

            <button
                class="choice-button"
                data-action="connectionType"
                data-type="amigos"
            >
                🫂 Amigos
            </button>

            <button
                class="choice-button"
                data-action="connectionType"
                data-type="importante"
            >
                💜 Alguém importante
            </button>

        </div>

        <div id="connectionArea"></div>

    `;

}


const connectionQuestions = {

    casal: [

        "Qual foi o momento mais engraçado que vocês viveram juntos?",

        "Se vocês pudessem viajar agora, para onde iriam?",

        "O que você mais admira nessa pessoa?",

        "Qual coisa simples vocês poderiam fazer mais juntos?",

        "Qual memória vocês nunca querem esquecer?"

    ],

    familia: [

        "Qual lembrança da família sempre faz você sorrir?",

        "O que vocês poderiam fazer juntos este mês?",

        "Qual comida lembra sua família?",

        "Qual história da família você gostaria de ouvir?",

        "O que você gostaria de agradecer a alguém da sua família?"

    ],

    amigos: [

        "Qual foi a situação mais engraçada que vocês já viveram?",

        "Se vocês tivessem uma noite livre, o que fariam?",

        "Qual música lembra a amizade de vocês?",

        "Qual viagem vocês deveriam fazer juntos?",

        "O que você mais valoriza nessa amizade?"

    ],

    importante: [

        "O que torna essa pessoa importante para você?",

        "Qual memória vocês têm que você gostaria de repetir?",

        "Existe algo que você gostaria de dizer para essa pessoa?",

        "Qual atividade vocês poderiam experimentar juntos?",

        "O que você gostaria que essa pessoa soubesse?"

    ]

};


function openConnectionCategory(type) {

    const area =
        document.getElementById("connectionArea");


    const activities = [

        {
            id: "question",
            title: "💭 Pergunta do dia",
            text: "Uma pergunta para vocês conversarem."
        },

        {
            id: "mostlikely",
            title: "😂 Quem é mais provável?",
            text: "Descubram quem combina mais com a situação."
        },

        {
            id: "wouldyou",
            title: "🤔 Você prefere?",
            text: "Escolham entre duas opções."
        },

        {
            id: "challenge",
            title: "🎯 Desafio para duas pessoas",
            text: "Façam uma pequena atividade juntos."
        },

        {
            id: "together",
            title: "✨ O que fazer juntos?",
            text: "Uma ideia simples para sair da rotina."
        }

    ];


    area.innerHTML = `

        <div class="section-heading">
            <h3>
                Escolha uma atividade
            </h3>
        </div>

        ${activities.map(activity => `

            <button
                class="option-card"
                style="width:100%;text-align:left;color:white;cursor:pointer"
                data-action="connectionActivity"
                data-activity="${activity.id}"
            >

                <strong>
                    ${activity.title}
                </strong>

                <p>
                    ${activity.text}
                </p>

            </button>

        `).join("")}

    `;


    area.dataset.type = type;

}


function startConnectionActivity(activity) {

    const area =
        document.getElementById("connectionArea");

    const type =
        area.dataset.type || "amigos";


    let content = "";


    if (activity === "question") {

        const list =
            connectionQuestions[type];

        const question =
            list[
                Math.floor(
                    Math.random() * list.length
                )
            ];


        content = `

            <div class="game-question">
                ${question}
            </div>

            <button
                class="modal-action"
                data-action="connectionActivity"
                data-activity="question"
            >
                Outra pergunta
            </button>

        `;

    }


    if (activity === "mostlikely") {

        const questions = [

            "Quem provavelmente esqueceria onde colocou o celular?",

            "Quem provavelmente viajaria sem planejar?",

            "Quem provavelmente começaria a dançar do nada?",

            "Quem provavelmente dormiria primeiro?",

            "Quem provavelmente faria uma surpresa para o outro?"

        ];


        content = `

            <div class="game-question">
                ${questions[Math.floor(Math.random() * questions.length)]}
            </div>

            <p class="timer-info">
                Apontem para a pessoa ao mesmo tempo.
            </p>

            <button
                class="modal-action"
                data-action="connectionActivity"
                data-activity="mostlikely"
            >
                Outra pergunta
            </button>

        `;

    }


    if (activity === "wouldyou") {

        const questions = [

            "Você prefere viajar para a praia ou para a montanha?",

            "Você prefere uma noite de filme ou uma noite de jogos?",

            "Você prefere receber uma carta ou uma surpresa?",

            "Você prefere cozinhar juntos ou pedir comida?",

            "Você prefere sair sem planejar ou organizar tudo antes?"

        ];


        content = `

            <div class="game-question">
                ${questions[Math.floor(Math.random() * questions.length)]}
            </div>

            <p class="timer-info">
                Cada pessoa escolhe uma resposta e explica o motivo.
            </p>

            <button
                class="modal-action"
                data-action="connectionActivity"
                data-activity="wouldyou"
            >
                Outra pergunta
            </button>

        `;

    }


    if (activity === "challenge") {

        const challenges = [

            "Conversem durante 5 minutos sem pegar no celular.",

            "Cada pessoa precisa contar uma memória favorita.",

            "Façam uma foto juntos e guardem o celular depois.",

            "Preparem alguma comida juntos.",

            "Cada pessoa precisa falar uma coisa que admira na outra."

        ];


        content = `

            <div class="game-question">
                🎯 ${challenges[Math.floor(Math.random() * challenges.length)]}
            </div>

            <button
                class="modal-action"
                data-action="connectionActivity"
                data-activity="challenge"
            >
                Outro desafio
            </button>

        `;

    }


    if (activity === "together") {

        const ideas = [

            "Façam uma caminhada juntos.",

            "Preparem uma sobremesa.",

            "Escolham um filme e façam uma noite temática.",

            "Joguem cartas ou algum jogo de tabuleiro.",

            "Façam uma lista de coisas que querem viver juntos.",

            "Visitem um lugar novo perto de vocês.",

            "Façam uma noite sem celular."

        ];


        content = `

            <div class="game-question">
                ✨ ${ideas[Math.floor(Math.random() * ideas.length)]}
            </div>

            <button
                class="modal-action"
                data-action="connectionActivity"
                data-activity="together"
            >
                Outra ideia
            </button>

        `;

    }


    currentUser.connectionHistory.push({

        type,
        activity,
        date: new Date().toISOString()

    });


    saveCurrentUser();

    addXP(5);

    updateStreak();


    area.innerHTML =
        area.innerHTML.split(
            `<div class="section-heading">`
        )[0] +
        content;


    showToast("+5 XP por criar uma conexão");


}


/* =========================================================
   JOGOS
========================================================= */

function renderGames() {

    return `

        <h2 class="modal-title">
            🎮 Jogos & brincadeiras
        </h2>

        <p class="modal-subtitle">
            Jogos para conversar, rir e interagir
            com quem está perto.
        </p>

        <div class="choice-grid">

            <button
                class="choice-button"
                data-action="gameType"
                data-game="mostlikely"
            >
                😂 Quem é mais provável?
            </button>

            <button
                class="choice-button"
                data-action="gameType"
                data-game="wouldyou"
            >
                🤔 Você prefere?
            </button>

            <button
                class="choice-button"
                data-action="gameType"
                data-game="truth"
            >
                🎲 Verdade ou desafio
            </button>

            <button
                class="choice-button"
                data-action="gameType"
                data-game="complete"
            >
                💬 Complete a frase
            </button>

            <button
                class="choice-button"
                data-action="gameType"
                data-game="challenge"
            >
                ⏱️ Desafio de 1 minuto
            </button>

            <button
                class="choice-button"
                data-action="gameType"
                data-game="random"
            >
                🎁 Pergunta aleatória
            </button>

        </div>

        <div id="gameArea"></div>

    `;

}


let currentGame = null;


const games = {

    mostlikely: [

        "Quem é mais provável de rir em uma situação séria?",

        "Quem é mais provável de esquecer onde deixou alguma coisa?",

        "Quem é mais provável de querer viajar amanhã?",

        "Quem é mais provável de fazer uma surpresa?",

        "Quem é mais provável de dormir primeiro?",

        "Quem é mais provável de começar uma conversa aleatória?"

    ],

    wouldyou: [

        "Você prefere viajar para qualquer lugar ou ganhar R$ 1.000?",

        "Você prefere uma noite de filmes ou uma noite de jogos?",

        "Você prefere viver sem redes sociais por uma semana ou sem streaming?",

        "Você prefere receber uma carta ou um presente surpresa?",

        "Você prefere morar na praia ou no interior?"

    ],

    truth: [

        "Conte uma coisa que poucas pessoas sabem sobre você.",

        "Qual foi a coisa mais engraçada que aconteceu com você?",

        "Faça um elogio sincero para alguém aqui.",

        "Conte uma memória que você gostaria de reviver.",

        "Faça uma imitação de alguém por 10 segundos."

    ],

    complete: [

        "Uma coisa que sempre me faz rir é...",

        "Se eu pudesse viajar agora, eu iria para...",

        "Uma coisa que quero aprender é...",

        "Uma memória que guardo com carinho é...",

        "Uma coisa que gostaria de fazer com vocês é..."

    ],

    challenge: [

        "Fiquem 1 minuto sem olhar para o celular.",

        "Cada pessoa precisa falar 3 coisas boas sobre o dia.",

        "Tentem fazer alguém do grupo rir em 1 minuto.",

        "Façam uma pose engraçada juntos.",

        "Criem uma história usando três palavras escolhidas pelo grupo."

    ],

    random: [

        "Qual foi a última coisa que te fez realmente feliz?",

        "Se hoje fosse um filme, qual seria o título?",

        "Qual lugar você gostaria de conhecer?",

        "O que você faria se tivesse um dia inteiro livre?",

        "Qual música representa seu momento atual?"

    ]

};


function startGame(game) {

    currentGame = game;

    renderGameQuestion();

}


function renderGameQuestion() {

    const area =
        document.getElementById("gameArea");


    const list =
        games[currentGame];


    const question =
        list[
            Math.floor(
                Math.random() * list.length
            )
        ];


    currentUser.gameHistory.push({

        game: currentGame,
        question,
        date: new Date().toISOString()

    });


    saveCurrentUser();


    area.innerHTML = `

        <div class="game-question">

            ${question}

        </div>

        <button
            class="modal-action"
            data-action="gameNext"
        >
            Próxima
        </button>

    `;

}


function nextGameQuestion() {

    addXP(2);

    renderGameQuestion();

}


/* =========================================================
   IDEIAS PARA UMA NOITE
========================================================= */

const nightIdeas = [

    {
        title: "🌙 Noite sem celular",
        description:
            "Coloquem os celulares longe, preparem alguma comida, escolham uma música e passem a noite conversando."
    },

    {
        title: "🍕 Noite da culinária",
        description:
            "Escolham uma receita simples e preparem juntos. A regra é ninguém ficar no celular enquanto cozinha."
    },

    {
        title: "🎬 Cinema diferente",
        description:
            "Escolham um filme, preparem pipoca e criem uma pequena sessão de cinema em casa."
    },

    {
        title: "💭 Noite das perguntas",
        description:
            "Cada pessoa faz perguntas que normalmente nunca faria. A ideia é descobrir algo novo sobre quem está perto."
    },

    {
        title: "😂 Noite das histórias",
        description:
            "Cada pessoa conta uma história engraçada ou uma memória que quase ninguém conhece."
    },

    {
        title: "🎲 Noite dos jogos",
        description:
            "Cartas, jogos de tabuleiro, mímica ou qualquer brincadeira que faça todo mundo participar."
    },

    {
        title: "📸 Noite da nostalgia",
        description:
            "Separem fotos antigas, relembrem momentos e contem as histórias por trás delas."
    },

    {
        title: "✨ Cada um escolhe",
        description:
            "Cada pessoa escolhe uma atividade de 20 minutos para o grupo fazer."
    }

];


function renderNight() {

    const idea =
        nightIdeas[
            Math.floor(
                Math.random() * nightIdeas.length
            )
        ];


    return `

        <h2 class="modal-title">
            🌙 Ideia para uma noite
        </h2>

        <p class="modal-subtitle">
            Porque uma noite boa não precisa
            acontecer dentro do celular.
        </p>

        <div class="option-card">

            <strong>
                ${idea.title}
            </strong>

            <p>
                ${idea.description}
            </p>

        </div>

        <button
            class="modal-action"
            data-action="newNight"
        >
            🎲 Outra ideia
        </button>

        <button
            class="modal-secondary"
            data-action="close"
        >
            Vou fazer essa!
        </button>

    `;

}


/* =========================================================
   REFLEXÃO
========================================================= */

const reflectionQuestions = [

    "O que fez você sorrir hoje?",

    "Qual foi o melhor momento da sua semana?",

    "O que você gostaria de fazer mais fora do celular?",

    "Existe alguém com quem você gostaria de conversar?",

    "Qual experiência você gostaria de viver este mês?",

    "O que está ocupando muito espaço na sua cabeça?",

    "Qual pequena mudança deixaria seus dias melhores?",

    "Quando foi a última vez que você se divertiu sem usar o celular?"

];


function renderReflection() {

    const question =
        reflectionQuestions[
            Math.floor(
                Math.random() * reflectionQuestions.length
            )
        ];


    return `

        <h2 class="modal-title">
            💭 Reflexão
        </h2>

        <p class="modal-subtitle">
            Não precisa ter uma resposta perfeita.
            Apenas pense.
        </p>

        <div class="game-question">

            ${question}

        </div>

        <textarea
            id="reflectionText"
            class="modal-textarea"
            placeholder="Escreva o que vier à sua cabeça..."
        ></textarea>

        <button
            class="modal-action"
            data-action="saveReflection"
        >
            Salvar reflexão
        </button>

        <button
            class="modal-secondary"
            data-action="newReflection"
        >
            Outra pergunta
        </button>

    `;

}


function saveReflection() {

    const textarea =
        document.getElementById("reflectionText");


    if (!textarea) return;


    const text =
        textarea.value.trim();


    if (!text) {

        showToast("Escreva sua reflexão primeiro.");

        return;

    }


    currentUser.reflections.unshift({

        question: "Reflexão do dia",
        text,
        date: new Date().toISOString()

    });


    saveCurrentUser();

    addXP(10);

    showToast("Reflexão salva! +10 XP");

    openExplore("reflection");

}


/* =========================================================
   CRIATIVIDADE
========================================================= */

const creativeIdeas = [

    "Desenhe alguma coisa usando a mão que você normalmente não usa.",

    "Crie uma história de 5 minutos usando três palavras aleatórias.",

    "Monte um look diferente usando roupas que você já tem.",

    "Crie uma playlist para representar uma fase da sua vida.",

    "Desenhe como seria o seu quarto dos sonhos.",

    "Invente um produto que resolveria um problema do seu dia.",

    "Faça uma colagem usando papéis, revistas ou fotos antigas.",

    "Escreva um poema sem precisar rimar.",

    "Tire cinco fotos contando uma pequena história.",

    "Crie uma atividade para fazer com sua família ou amigos."

];


function renderCreative() {

    const idea =
        creativeIdeas[
            Math.floor(
                Math.random() * creativeIdeas.length
            )
        ];


    return `

        <h2 class="modal-title">
            🎨 Criatividade
        </h2>

        <p class="modal-subtitle">
            Não precisa ser artista.
            Só precisa experimentar.
        </p>

        <div class="option-card">

            <strong>
                Sua ideia:
            </strong>

            <p>
                ${idea}
            </p>

        </div>

        <button
            class="modal-action"
            data-action="newCreative"
        >
            ✨ Nova ideia
        </button>

        <button
            class="modal-secondary"
            data-action="creativeDone"
            onclick="creativeDone()"
        >
            Fiz a atividade!
        </button>

    `;

}


function creativeDone() {

    currentUser.exploreStats.creative++;

    saveCurrentUser();

    addXP(10);

    updateStreak();

    showToast("Atividade criativa registrada! +10 XP");

    closeExploreModal();

}


/* =========================================================
   RELAXAR
========================================================= */

function renderRelax() {

    const techniques = [

        {
            id: "senses",
            title: "👀 5-4-3-2-1",
            description: "Use os sentidos para voltar sua atenção ao presente."
        },

        {
            id: "shoulders",
            title: "🙆 Alongamento",
            description: "Solte os ombros e pescoço por alguns minutos."
        },

        {
            id: "water",
            title: "💧 Pausa para água",
            description: "Pegue água e beba devagar."
        },

        {
            id: "silence",
            title: "🤫 Dois minutos de silêncio",
            description: "Fique em silêncio e observe sua respiração."
        },

        {
            id: "muscles",
            title: "🧘 Relaxamento muscular",
            description: "Contraia e solte partes do corpo lentamente."
        }

    ];


    return `

        <h2 class="modal-title">
            🧘 Relaxar
        </h2>

        <p class="modal-subtitle">
            Escolha uma prática rápida.
        </p>

        ${techniques.map(item => `

            <button
                class="option-card"
                style="width:100%;text-align:left;color:white;cursor:pointer"
                data-action="relaxTechnique"
                data-technique="${item.id}"
            >

                <strong>
                    ${item.title}
                </strong>

                <p>
                    ${item.description}
                </p>

            </button>

        `).join("")}

        <div id="relaxArea"></div>

    `;

}


function showRelaxTechnique(technique) {

    const area =
        document.getElementById("relaxArea");


    const texts = {

        senses:
            "Olhe ao seu redor e encontre 5 coisas que você vê, 4 que pode tocar, 3 que consegue ouvir, 2 que consegue cheirar e 1 que consegue sentir.",

        shoulders:
            "Eleve os ombros lentamente, segure por alguns segundos e solte. Depois faça movimentos suaves com o pescoço.",

        water:
            "Pegue um copo de água. Beba devagar e preste atenção na temperatura, no sabor e na sensação.",

        silence:
            "Sente-se confortavelmente. Durante dois minutos, tente não fazer nada. Apenas perceba sua respiração.",

        muscles:
            "Contraia os pés por alguns segundos e solte. Depois pernas, mãos, braços e ombros. Faça tudo lentamente."

    };


    area.innerHTML = `

        <div class="option-card">

            <strong>
                Faça agora:
            </strong>

            <p>
                ${texts[technique]}
            </p>

        </div>

        <button
            class="modal-action"
            onclick="finishRelax()"
        >
            Concluí
        </button>

    `;

}


function finishRelax() {

    currentUser.exploreStats.relax++;

    saveCurrentUser();

    addXP(5);

    updateStreak();

    showToast("Momento de relaxamento registrado! +5 XP");

    closeExploreModal();

}


/* =========================================================
   PERFIL
========================================================= */

function editProfile() {

    const newName =
        prompt(
            "Digite seu novo nome:",
            currentUser.name
        );


    if (!newName) return;


    currentUser.name =
        newName.trim();


    saveCurrentUser();

    loadUser();

    showToast("Perfil atualizado.");

}


async function changePassword() {
    const newPassword = prompt("Digite sua nova senha (mínimo de 6 caracteres):");
    if (!newPassword || newPassword.length < 6) {
        showToast("A nova senha precisa ter pelo menos 6 caracteres.");
        return;
    }
    try {
        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        if (error) throw error;
        showToast("Senha alterada com sucesso.");
    } catch (error) {
        console.error("Erro ao alterar senha:", error);
        showToast("Não foi possível alterar a senha. Tente novamente.");
    }
}

function showAchievements() {

    const completed =
        currentUser.completedMissions.length;

    const connections =
        currentUser.connectionHistory.length;

    const offline =
        currentUser.exploreStats.offlineMinutes;


    openSimpleModal(`

        <h2 class="modal-title">
            🏆 Suas conquistas
        </h2>

        <div class="option-card">

            <strong>
                🎯 Missões
            </strong>

            <p>
                ${completed} missão(ões) concluída(s)
            </p>

        </div>

        <div class="option-card">

            <strong>
                📵 Vida OFF
            </strong>

            <p>
                ${offline} minutos longe da tela
            </p>

        </div>

        <div class="option-card">

            <strong>
                🤝 Conexões
            </strong>

            <p>
                ${connections} momentos de conexão registrados
            </p>

        </div>

        <button
            class="modal-action"
            data-action="close"
        >
            Fechar
        </button>

    `);

}


function openSimpleModal(content) {

    document.getElementById("modalContent").innerHTML =
        content;

    document.getElementById("exploreModal")
        .classList.remove("hidden");

}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        currentUser = null;
        showToast("Você saiu da conta.");
        setTimeout(() => showScreen("loginScreen"), 400);
    } catch (error) {
        console.error("Erro ao sair:", error);
        showToast("Não foi possível encerrar a sessão. Tente novamente.");
    }
}

/* =========================================================
   TIMER
========================================================= */

function stopActiveTimer() {

    if (activeTimer) {

        clearInterval(activeTimer);

        activeTimer = null;
    }

}
