import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt'


import Appointment from '../models/Appointment';
import User from '../models/User';
import File from '../models/File';
import Notification from '../schemas/Notification';

import Mail from '../../lib/Mail';

class AppointmentController {

  async index(req, res){
    const { page = 1 } = req.query;

    const appointments = await Appointment.findAll({
      where: { user_id: req.userId, canceled_at: null},
      order: ['date'],
      attributes: ['id', 'date'],
      limit: 20,
      offset: (page - 1 ) * 20,
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: [ 'id','path','url']
            }
          ]
        }
      ]

    }).catch(err => {
      return res.status(400).json(err);

    });

    return res.status(200).json(appointments);

  }

  async store(req, res) {

    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: "Validation Fails!" });

    }

    const { provider_id, date } = req.body;

    // Check if provider_id is from a provider

    const checkIsProvider = await User.findOne({
      where: { id: provider_id, provider: true }
    }).catch(err => {
      return res.json(err);
    });

    if(req.userId === provider_id){
      return res.status(400).json({ erro: 'Cant make appointments with yourself'})
    }

    if (!checkIsProvider) {
      return res
        .status(401)
        .json({ error: 'You can only creat appointments with provider' });

    }

    // Check for past dates
    const hourStart = startOfHour(parseISO(date));

    if(isBefore(hourStart, new Date())){
      return res.status(400).json({ error: 'Past dates are not allowed'});
    }

    // Check Date availabilty

    const checkAvailability = await Appointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: hourStart
      }
    }).catch(err => {
      return res.status(400).json(err);
    });

    if(checkAvailability){
      return res.status(400).json({ error: 'Date not available'});
    }

    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date
    }).catch(err => {
      console.log("error \n")
      return res.json(err);
    });

    // Notify appointment provider

    const user = await User.findByPk(req.userId);
    const formattedDate = format(
      hourStart, 
      "'dia' dd 'de' MMMM', ás' H:mm'h'",
      { locale: pt }
      );

    await Notification.create({
      content: `Novo agendamento de ${user.name} para o ${formattedDate}`,
      user: provider_id
    });

    return res.json(appointment);
  }

  async delete(req, res){

    const appointment = await Appointment.findByPk(req.params.id,
      {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: [ 'name', 'email']
        }
      ]
    }).catch(err =>{
      return res.json(err);
    });
    
    if(appointment.user_id !== req.userId){
      return res.status(401).json({ 
        error: "You don't have permission to cancel" 
      });
    }
    
    const dateWithSub = subHours(appointment.date, 2);

    if(isBefore(dateWithSub, new Date())){
      return res.status(401).json({
        error: 'You can only cancel appointments 2h before'
      });
    }

    appointment.canceled_at = new Date();

    await appointment.save().catch(err => {
      return res.json(err);
    });

    await Mail.sendMail({
      to: `${appointment.provider.name} <${appointment.provider.email}>`,
      subject: 'Agendamento cancelado',
      text: 'Você tem um novo cancelamento'
    }).catch(err => {
      return res.json(err);
    });

    return res.json(appointment);
  }
}
export default new AppointmentController();