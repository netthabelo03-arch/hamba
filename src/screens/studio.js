// Studio: members submit designs, everyone votes. At 500 votes a design is
// made, and the designer earns 5% of every sale. Also the submit form.

import { listDesigns, myDesigns, vote, uploadDesignImage, submitDesign } from '../community/api.js';
import { VOTE_GOAL, ROYALTY_RATE, DESIGN_KINDS, DESIGN_STATUS, checkDesign, voteBlocked, voteProgress, sortDesigns } from '../community/rules.js';
import { needLogin, reportControl, screenHead } from '../community/ui.js';
import { cropPhoto } from '../market/cropper.js';
import { checkPhotoFile, PHOTO_TYPES } from '../market/validate.js';
import { input, textArea, select, showErrors, sampleNote } from '../market/ui.js';
import { isDemo } from '../auth/api.js';
import { friendlyAuthError } from '../auth/errors.js';
import { loadViewer } from '../viewer.js';
import { tabBar, displayName } from '../shell.js';
import { el, whileBusy, messageBox } from '../dom.js';

let sortBy = 'top';

export async function renderStudio({ session, navigate }) {
  const userId = session?.user?.id ?? null;
  const [designs, mine] = await Promise.all([listDesigns(userId), userId ? myDesigns(userId) : []]);
  const made = designs.filter((d) => d.status === 'made');
  const list = el('div', { class: 'stack' });

  function designCard(design) {
    const blocked = voteBlocked(design, userId);
    const button = el('button', { type: 'button', class: design.voted ? 'vote vote--on' : 'vote', 'aria-pressed': String(design.voted), 'aria-label': `${design.voted ? 'Remove vote for' : 'Vote for'} ${design.title}`, text: design.voted ? 'Voted' : 'Vote' });
    if (design.designer_id === userId) { button.disabled = true; button.textContent = 'Yours'; button.title = blocked; }
    const count = el('span', { class: 'line__meta', text: `by ${design.designer_name} · ${design.votes} of ${VOTE_GOAL}` });
    const bar = el('div', { class: 'bar' }, [el('div', { class: 'bar__fill', style: `width: ${voteProgress(design.votes)}%` })]);
    const error = el('p', { class: 'field__error', role: 'alert' });
    error.hidden = true;
    button.addEventListener('click', () => {
      if (!userId) { needLogin(navigate); return; }
      const reason = voteBlocked(design, userId);
      if (reason) { error.textContent = reason; error.hidden = false; return; }
      whileBusy(button, '…', async () => {
        try {
          await vote(design.id, userId, !design.voted);
          design.voted = !design.voted;
          design.votes += design.voted ? 1 : -1;
          card.replaceWith(designCard(design));
        } catch (e) {
          error.textContent = friendlyAuthError(e);
          error.hidden = false;
        }
      });
    });
    const { button: reportButton, holder } = reportControl({ kind: 'design', itemId: design.id, session, navigate });
    const card = el('article', { class: 'design' }, [
      el('img', { class: 'design__image', src: design.image, alt: design.title }),
      el('div', { class: 'design__body' }, [
        el('b', { class: 'design__title', text: design.title }),
        count,
        bar,
        el('p', { class: 'design__about', text: design.about }),
        el('div', { class: 'line__actions' }, [reportButton]),
        holder,
        error,
      ]),
      button,
    ]);
    return card;
  }

  function draw() {
    const open = sortDesigns(designs.filter((d) => d.status === 'open'), sortBy);
    list.replaceChildren(...(open.length ? open.map(designCard) : [el('div', { class: 'empty' }, [el('p', { class: 'empty__text', text: 'No designs open for votes yet. Be the first to submit one.' })])]));
  }
  const sorts = el('div', { class: 'chips' }, [['top', 'Most votes'], ['new', 'Newest']].map(([id, text]) => {
    const chip = el('button', { type: 'button', class: 'chip-link chip-link--small', text });
    chip.setAttribute('aria-pressed', String(sortBy === id));
    chip.addEventListener('click', () => { sortBy = id; for (const c of sorts.children) c.setAttribute('aria-pressed', String(c === chip)); draw(); });
    return chip;
  }));
  draw();

  const submit = el('a', { href: '#/studio/new', class: 'button button--primary button--small', text: 'Submit' });
  const mineSection = mine.length ? [
    el('h2', { class: 'section-title', text: 'Your designs' }),
    ...mine.map((d) => el('div', { class: 'line' }, [
      el('img', { class: 'line__thumb', src: d.image, alt: '' }),
      el('div', { class: 'line__body' }, [
        el('b', { text: d.title }),
        el('span', { class: `status status--${d.status === 'open' || d.status === 'made' ? 'approved' : d.status === 'rejected' ? 'suspended' : 'pending'}`, text: DESIGN_STATUS[d.status].tag }),
        el('span', { class: 'line__meta', text: d.status === 'rejected' && d.review_note ? `To fix: ${d.review_note}` : d.status === 'open' ? `${d.votes} of ${VOTE_GOAL} votes` : DESIGN_STATUS[d.status].about }),
      ]),
    ])),
  ] : [];

  return [
    screenHead('Studio', '#/', submit),
    el('p', { class: 'lead', text: `Members design, everyone votes. At ${VOTE_GOAL} votes it gets made, and the designer earns ${ROYALTY_RATE * 100}% of every sale.` }),
    ...made.map((d) => el('div', { class: 'made' }, [el('b', { text: `${d.title} is made and selling` }), el('span', { text: `${d.designer_name} earns ${ROYALTY_RATE * 100}% of every one sold` })])),
    sorts,
    list,
    ...sampleNote(isDemo()),
    ...mineSection,
    tabBar('home'),
  ];
}

export async function renderStudioNew({ session, navigate }) {
  const { profile } = await loadViewer(session);
  let image = null;
  const preview = el('label', { for: 'd-image', class: 'design-pick' }, [el('span', { class: 'design-pick__plus', text: '+' }), el('span', { class: 'field__hint', text: 'Add a picture of your design' })]);
  const picker = el('input', { type: 'file', id: 'd-image', accept: PHOTO_TYPES.join(','), class: 'visually-hidden' });
  const imageError = el('p', { class: 'field__error', id: 'd-image-error', role: 'alert' });
  imageError.hidden = true;
  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    picker.value = '';
    if (!file) return;
    const problem = checkPhotoFile(file);
    if (problem) { imageError.textContent = problem; imageError.hidden = false; return; }
    const blob = await cropPhoto(file).catch(() => null);
    if (!blob) return;
    image = blob;
    imageError.hidden = true;
    preview.replaceChildren(el('img', { src: URL.createObjectURL(blob), alt: 'Your design' }));
  });

  const fields = {
    title: input({ id: 'd-title', label: 'Name of your design' }),
    kind: select({ id: 'd-kind', label: 'What is it?', options: DESIGN_KINDS }),
    about: textArea({ id: 'd-about', label: 'Tell members about it', rows: 4, hint: 'Colours, materials and the idea or place behind it.' }),
  };
  const own = el('input', { type: 'checkbox', id: 'd-own', class: 'check__box' });
  const ownError = el('p', { class: 'field__error', role: 'alert' });
  ownError.hidden = true;
  const message = messageBox();
  const send = el('button', { type: 'submit', class: 'button button--primary', text: 'Send for review' });
  const form = el('form', { class: 'form', novalidate: '' }, [
    el('div', { class: 'field' }, [preview, picker, imageError]),
    ...Object.values(fields).map((f) => f.node),
    el('div', { class: 'field' }, [el('label', { class: 'check', for: 'd-own' }, [own, el('span', { class: 'check__label', text: 'This is my own design. It does not copy another brand’s logo or artwork.' })]), ownError]),
    el('p', { class: 'field__hint', text: `Hamba checks each design before voting opens. If it reaches ${VOTE_GOAL} votes, Hamba gets it made and you earn ${ROYALTY_RATE * 100}% of every sale.` }),
    message.node,
    send,
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.clear();
    const { ok, errors, value } = checkDesign({ title: fields.title.input.value, about: fields.about.input.value, kind: fields.kind.input.value, hasImage: Boolean(image), ownWork: own.checked });
    showErrors({ title: fields.title, kind: fields.kind, about: fields.about }, errors);
    imageError.textContent = errors.image ?? '';
    imageError.hidden = !errors.image;
    ownError.textContent = errors.ownWork ?? '';
    ownError.hidden = !errors.ownWork;
    if (!ok) return;
    await whileBusy(send, 'Sending…', async () => {
      try {
        const url = await uploadDesignImage(session.user.id, image);
        const name = profile?.full_name ? `${profile.full_name.split(' ')[0]} ${(profile.full_name.split(' ')[1] ?? '').charAt(0)}${profile.full_name.split(' ')[1] ? '.' : ''}`.trim() : displayName(profile, session);
        await submitDesign(session.user.id, name, { ...value, image: url });
        navigate('#/studio');
      } catch (error) {
        message.show(friendlyAuthError(error));
      }
    });
  });

  return [screenHead('Submit a design', '#/studio'), form, tabBar('home')];
}
